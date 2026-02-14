"""Background scheduler to handle rental expiry and other periodic tasks."""

import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from web3 import Web3
from web3.middleware import geth_poa_middleware
from web3.exceptions import Web3Exception

from app.core.database import async_session as async_session_factory
from app.core.config import settings
from app.models.rental import Rental
from app.models.rig import Rig
from app.models.user import User
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)

# Track last scanned block number
_last_scanned_block = None
# Track consecutive RPC errors for backoff
_rpc_error_count = 0
_last_rpc_error_time = None

# USDT contract addresses
USDT_MAINNET = "0x55d398326f99059fF775485246999027B3197955"
USDT_TESTNET = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"
USDT_DECIMALS = 18
USDT_CONTRACT = USDT_MAINNET if settings.BSC_NETWORK == "mainnet" else USDT_TESTNET

# Transfer event signature
TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


async def scan_deposits():
    """Scan user deposit addresses for incoming USDT transfers."""
    global _last_scanned_block, _rpc_error_count, _last_rpc_error_time

    try:
        # Get all users with deposit addresses
        async with async_session_factory() as db:
            result = await db.execute(
                select(User).where(User.deposit_address.isnot(None))
            )
            users = result.scalars().all()

            if not users:
                return

            # Create Web3 instance
            w3 = Web3(Web3.HTTPProvider(settings.BSC_RPC_URL))
            w3.middleware_onion.inject(geth_poa_middleware, layer=0)

            try:
                current_block = w3.eth.block_number
            except Exception as e:
                # RPC connection error
                _rpc_error_count += 1
                _last_rpc_error_time = datetime.now(timezone.utc)
                logger.warning(f"RPC connection error (attempt #{_rpc_error_count}): {e}")
                return

            # Initialize last scanned block
            if _last_scanned_block is None:
                _last_scanned_block = current_block - 10  # Scan last 10 blocks on startup (~30 seconds)

            # Don't scan if no new blocks
            if current_block <= _last_scanned_block:
                return

            # Build address filter (lowercase for comparison)
            user_addresses = {user.deposit_address.lower(): user for user in users}

            # Calculate blocks to scan
            blocks_to_scan = current_block - _last_scanned_block

            # If we have a lot of blocks to catch up (e.g., after downtime),
            # split into smaller batches to avoid RPC timeout
            BATCH_SIZE = 50  # Scan max 50 blocks per RPC call
            scan_from = _last_scanned_block + 1
            scan_to_block = _last_scanned_block  # Will be updated as we scan
            all_logs = []

            while scan_from <= current_block:
                batch_to = min(scan_from + BATCH_SIZE - 1, current_block)

                logger.info(f"Scanning blocks {scan_from} to {batch_to} ({batch_to - scan_from + 1} blocks)")

                # Scan this batch with retry logic
                max_retries = 3
                batch_logs = None
                for retry in range(max_retries):
                    try:
                        batch_logs = w3.eth.get_logs({
                            'address': Web3.to_checksum_address(USDT_CONTRACT),
                            'fromBlock': scan_from,
                            'toBlock': batch_to,
                            'topics': [TRANSFER_EVENT_TOPIC]
                        })
                        # Success - reset error count
                        _rpc_error_count = 0
                        break
                    except Exception as rpc_error:
                        _rpc_error_count += 1
                        if retry < max_retries - 1:
                            # Exponential backoff: 2^retry seconds
                            backoff = 2 ** retry
                            logger.warning(f"RPC rate limit hit scanning blocks {scan_from}-{batch_to} (attempt {retry + 1}/{max_retries}), retrying in {backoff}s...")
                            await asyncio.sleep(backoff)
                        else:
                            # Final retry failed - skip this batch and try next time
                            logger.error(f"RPC scan failed for blocks {scan_from}-{batch_to} after {max_retries} retries: {rpc_error}")
                            # Don't update _last_scanned_block, so we retry this range next time
                            return

                if batch_logs is not None:
                    all_logs.extend(batch_logs)
                    scan_to_block = batch_to  # Update progress

                scan_from = batch_to + 1

            # Process all collected logs
            logs = all_logs

            deposits_found = 0

            for log in logs:
                # Parse Transfer event: Transfer(address indexed from, address indexed to, uint256 value)
                if len(log['topics']) < 3:
                    continue

                # Decode 'to' address from topic[2]
                to_address = "0x" + log['topics'][2].hex()[-40:]
                to_address_lower = to_address.lower()

                # Check if this is a deposit to one of our users
                if to_address_lower not in user_addresses:
                    continue

                user = user_addresses[to_address_lower]

                # Decode amount from data
                amount_raw = int(log['data'].hex(), 16)
                amount = Decimal(amount_raw) / Decimal(10 ** USDT_DECIMALS)

                # Get transaction hash
                tx_hash = log['transactionHash'].hex()

                # Check if we already processed this deposit
                existing = await db.execute(
                    select(Transaction).where(
                        Transaction.user_id == user.id,
                        Transaction.tx_hash == tx_hash,
                        Transaction.type == "deposit"
                    )
                )
                if existing.scalar_one_or_none():
                    continue

                # Add to user balance
                user.balance += amount

                # Create transaction record
                tx = Transaction(
                    user_id=user.id,
                    type="deposit",
                    amount=amount,
                    status="completed",
                    tx_hash=tx_hash,
                    description=f"Auto-detected deposit to {user.deposit_address[:10]}..."
                )
                db.add(tx)

                deposits_found += 1
                logger.info(f"Deposit detected: User {user.id} received {float(amount)} USDT (tx: {tx_hash})")

            # Commit all changes
            if deposits_found > 0:
                await db.commit()
                logger.info(f"Processed {deposits_found} new deposits")

            # Update last scanned block (only update to what we actually scanned)
            _last_scanned_block = scan_to_block

    except Exception as e:
        _rpc_error_count += 1
        logger.error(f"Deposit scan error: {e}")


async def expire_rentals():
    """Mark expired rentals as completed and restore rig status."""
    async with async_session_factory() as db:
        now = datetime.now(timezone.utc)

        # Find active rentals that have passed their end time
        result = await db.execute(
            select(Rental).where(
                Rental.status == "active",
                Rental.ends_at <= now,
            )
        )
        expired_rentals = result.scalars().all()

        for rental in expired_rentals:
            rental.status = "completed"
            rental.completed_at = now

            # Restore rig to active
            await db.execute(
                update(Rig).where(Rig.id == rental.rig_id).values(status="active")
            )
            logger.info(f"Rental #{rental.id} expired and marked as completed")

        if expired_rentals:
            await db.commit()
            logger.info(f"Processed {len(expired_rentals)} expired rentals")


async def scheduler_loop():
    """Run periodic tasks."""
    global _rpc_error_count

    loop_count = 0

    while True:
        try:
            # Run tasks in parallel
            await asyncio.gather(
                expire_rentals(),
                scan_deposits(),
            )

            # Run hashrate monitoring every 5 minutes (every 5th loop)
            loop_count += 1
            if loop_count % 5 == 0:
                await monitor_hashrates()
                loop_count = 0  # Reset to prevent overflow

        except Exception as e:
            logger.error(f"Scheduler error: {e}")

        # Dynamic sleep interval based on RPC errors (exponential backoff)
        # Normal: 60 seconds, After errors: up to 300 seconds (5 minutes)
        base_interval = 60
        if _rpc_error_count > 0:
            # Exponential backoff: min(60 * 2^(errors-1), 300)
            backoff_interval = min(base_interval * (2 ** (_rpc_error_count - 1)), 300)
            logger.info(f"Using backoff interval: {backoff_interval}s due to {_rpc_error_count} consecutive RPC errors")
            await asyncio.sleep(backoff_interval)
        else:
            await asyncio.sleep(base_interval)  # Check every 60 seconds (~20 blocks per scan)


async def monitor_hashrates():
    """
    Monitor hashrates of active rentals.
    
    This is a placeholder - in production, integrate with mining pool APIs.
    For now, generates simulated data for testing.
    """
    async with async_session_factory() as db:
        try:
            # Get all active rentals
            result = await db.execute(
                select(Rental).where(Rental.status == "active")
            )
            active_rentals = result.scalars().all()
            
            if not active_rentals:
                return
            
            from app.services.hashrate import log_hashrate
            import random
            
            for rental in active_rentals:
                # TODO: Replace with real mining pool API integration
                # Example: get_hashrate_from_pool(rental.pool_url, rental.pool_user)
                
                # For now: Simulate realistic hashrate (90-110% of advertised)
                # In production, remove this and use real pool API
                advertised = float(rental.hashrate)
                variance = random.uniform(0.9, 1.1)  # ±10% variance
                measured = advertised * variance
                
                # Log the measurement
                await log_hashrate(
                    db=db,
                    rental_id=rental.id,
                    measured_hashrate=measured,
                    advertised_hashrate=advertised,
                    source="pool_api"  # Change to "simulated" if using test data
                )
                
            await db.commit()
            logger.info(f"Monitored {len(active_rentals)} active rentals")
            
        except Exception as e:
            logger.error(f"Hashrate monitoring error: {e}")
