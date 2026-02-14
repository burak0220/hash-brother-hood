#!/usr/bin/env python3
"""
Stratum Mining Proxy with Real-time Hashrate Monitoring

Forwards mining traffic from rig to pool while measuring hashrate.
Reports hashrate to platform API every minute.
"""

import asyncio
import json
import logging
import time
import os
import httpx
from datetime import datetime
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class HashrateTracker:
    """Track shares and calculate hashrate."""

    def __init__(self, rental_id: int, advertised_hashrate: float):
        self.rental_id = rental_id
        self.advertised_hashrate = advertised_hashrate
        self.shares_submitted = 0
        self.shares_accepted = 0
        self.shares_rejected = 0
        self.start_time = time.time()
        self.last_report_time = time.time()

    def add_share(self, accepted: bool = True):
        """Track submitted share."""
        self.shares_submitted += 1
        if accepted:
            self.shares_accepted += 1
        else:
            self.shares_rejected += 1

    def calculate_hashrate(self) -> float:
        """
        Calculate hashrate based on submitted shares.

        Simplified calculation: shares per second * difficulty
        For more accuracy, use actual share difficulty.
        """
        elapsed = time.time() - self.start_time
        if elapsed < 1:
            return 0.0

        # Shares per second
        shares_per_sec = self.shares_submitted / elapsed

        # Estimate: 1 share ≈ difficulty worth of hashes
        # For Bitcoin/SHA256: difficulty 1 ≈ 4.3 GH
        # Adjust based on your algorithm
        estimated_hashrate = shares_per_sec * 4.3  # in GH/s

        return estimated_hashrate

    def should_report(self) -> bool:
        """Check if enough time passed for reporting (every 60 seconds)."""
        return (time.time() - self.last_report_time) >= 60

    def reset_for_next_period(self):
        """Reset counters for next reporting period."""
        self.shares_submitted = 0
        self.shares_accepted = 0
        self.shares_rejected = 0
        self.start_time = time.time()
        self.last_report_time = time.time()


class StratumProxy:
    """Stratum mining proxy server."""

    def __init__(
        self,
        rental_id: int,
        listen_port: int,
        target_pool: str,
        target_port: int,
        advertised_hashrate: float,
        api_url: str,
        api_key: str
    ):
        self.rental_id = rental_id
        self.listen_port = listen_port
        self.target_pool = target_pool
        self.target_port = target_port
        self.tracker = HashrateTracker(rental_id, advertised_hashrate)
        self.api_url = api_url
        self.api_key = api_key
        self.running = True

    async def handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        """Handle incoming miner connection."""
        client_addr = writer.get_extra_info('peername')
        logger.info(f"Rental #{self.rental_id}: Miner connected from {client_addr}")

        try:
            # Connect to target pool
            pool_reader, pool_writer = await asyncio.open_connection(
                self.target_pool,
                self.target_port
            )
            logger.info(f"Rental #{self.rental_id}: Connected to pool {self.target_pool}:{self.target_port}")

            # Relay traffic both ways
            await asyncio.gather(
                self.relay_client_to_pool(reader, pool_writer),
                self.relay_pool_to_client(pool_reader, writer),
                return_exceptions=True
            )

        except Exception as e:
            logger.error(f"Rental #{self.rental_id}: Connection error: {e}")
        finally:
            writer.close()
            await writer.wait_closed()
            logger.info(f"Rental #{self.rental_id}: Miner disconnected")

    async def relay_client_to_pool(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        """Relay data from miner to pool, tracking share submissions."""
        while self.running:
            try:
                data = await reader.readline()
                if not data:
                    break

                # Parse stratum message
                try:
                    message = json.loads(data.decode('utf-8'))

                    # Track share submissions
                    if message.get('method') == 'mining.submit':
                        self.tracker.add_share(accepted=True)
                        logger.debug(f"Rental #{self.rental_id}: Share submitted (total: {self.tracker.shares_submitted})")

                        # Report hashrate if interval passed
                        if self.tracker.should_report():
                            await self.report_hashrate()

                except json.JSONDecodeError:
                    pass  # Non-JSON data, just forward

                writer.write(data)
                await writer.drain()

            except Exception as e:
                logger.error(f"Rental #{self.rental_id}: Client->Pool relay error: {e}")
                break

    async def relay_pool_to_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        """Relay data from pool to miner, tracking accepted/rejected shares."""
        while self.running:
            try:
                data = await reader.readline()
                if not data:
                    break

                # Parse pool response
                try:
                    message = json.loads(data.decode('utf-8'))

                    # Track share responses
                    if 'result' in message:
                        # result=true means accepted, result=false or error means rejected
                        if message.get('result') is False or 'error' in message:
                            self.tracker.shares_rejected += 1
                            self.tracker.shares_accepted -= 1  # Correction

                except json.JSONDecodeError:
                    pass

                writer.write(data)
                await writer.drain()

            except Exception as e:
                logger.error(f"Rental #{self.rental_id}: Pool->Client relay error: {e}")
                break

    async def report_hashrate(self):
        """Report measured hashrate to platform API."""
        try:
            hashrate = self.tracker.calculate_hashrate()

            logger.info(
                f"Rental #{self.rental_id}: Hashrate: {hashrate:.2f} GH/s "
                f"(Shares: {self.tracker.shares_submitted}, "
                f"Accepted: {self.tracker.shares_accepted}, "
                f"Rejected: {self.tracker.shares_rejected})"
            )

            # Send to API
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    f"{self.api_url}/api/v1/internal/hashrate-update",
                    json={
                        "rental_id": self.rental_id,
                        "measured_hashrate": hashrate,
                        "difficulty": 1.0,
                        "shares_count": self.tracker.shares_submitted
                    },
                    headers={"X-Internal-Key": self.api_key}
                )
                response.raise_for_status()
                logger.info(f"Rental #{self.rental_id}: Hashrate reported to API")

            # Reset for next period
            self.tracker.reset_for_next_period()

        except Exception as e:
            logger.error(f"Rental #{self.rental_id}: Failed to report hashrate: {e}")

    async def start(self):
        """Start proxy server."""
        server = await asyncio.start_server(
            self.handle_client,
            '0.0.0.0',
            self.listen_port
        )

        addr = server.sockets[0].getsockname()
        logger.info(f"Rental #{self.rental_id}: Stratum proxy listening on {addr}")
        logger.info(f"Rental #{self.rental_id}: Forwarding to {self.target_pool}:{self.target_port}")

        async with server:
            await server.serve_forever()

    def stop(self):
        """Stop proxy server."""
        self.running = False


async def main():
    """Run proxy from environment variables."""
    rental_id = int(os.getenv('RENTAL_ID', '0'))
    listen_port = int(os.getenv('LISTEN_PORT', '3333'))
    target_pool = os.getenv('TARGET_POOL', 'pool.example.com')
    target_port = int(os.getenv('TARGET_PORT', '3333'))
    advertised_hashrate = float(os.getenv('ADVERTISED_HASHRATE', '100.0'))
    api_url = os.getenv('API_URL', 'http://api:8000')
    api_key = os.getenv('INTERNAL_API_KEY', 'internal-secret-key')

    logger.info(f"Starting Stratum Proxy for Rental #{rental_id}")
    logger.info(f"Listen: 0.0.0.0:{listen_port}")
    logger.info(f"Target: {target_pool}:{target_port}")
    logger.info(f"Advertised hashrate: {advertised_hashrate} TH/s")

    proxy = StratumProxy(
        rental_id=rental_id,
        listen_port=listen_port,
        target_pool=target_pool,
        target_port=target_port,
        advertised_hashrate=advertised_hashrate,
        api_url=api_url,
        api_key=api_key
    )

    try:
        await proxy.start()
    except KeyboardInterrupt:
        logger.info("Shutting down proxy...")
        proxy.stop()


if __name__ == '__main__':
    asyncio.run(main())
