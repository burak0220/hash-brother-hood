"""
BSC (Binance Smart Chain) blockchain service for USDT BEP-20 operations.

Handles:
- Deposit verification: Validates tx_hash on BSC, confirms USDT transfer to platform address
- Withdrawal execution: Sends USDT from hot wallet to user's BSC address
"""
import asyncio
import logging
from decimal import Decimal

from web3 import Web3
from web3.middleware import geth_poa_middleware

from app.core.config import settings

logger = logging.getLogger(__name__)

# BSC USDT (Tether) BEP-20 contract addresses
USDT_MAINNET = "0x55d398326f99059fF775485246999027B3197955"
USDT_TESTNET = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"  # BSC Testnet USDT
USDT_DECIMALS = 18

# Select contract based on network config
USDT_CONTRACT_ADDRESS = USDT_MAINNET if settings.BSC_NETWORK == "mainnet" else USDT_TESTNET
BSC_CHAIN_ID = 56 if settings.BSC_NETWORK == "mainnet" else 97

# ERC-20 ABI (minimal: transfer, balanceOf)
USDT_ABI = [
    {
        "constant": False,
        "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"},
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function",
    },
]

# keccak256("Transfer(address,address,uint256)")
TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


def _get_web3() -> Web3:
    """Create a Web3 instance connected to BSC."""
    w3 = Web3(Web3.HTTPProvider(settings.BSC_RPC_URL))
    w3.middleware_onion.inject(geth_poa_middleware, layer=0)
    return w3


def _verify_deposit_sync(
    tx_hash: str, expected_amount: Decimal, platform_address: str
) -> dict:
    """Synchronous BSC deposit verification (runs in thread pool)."""
    w3 = _get_web3()

    try:
        receipt = w3.eth.get_transaction_receipt(tx_hash)
    except Exception as e:
        logger.warning(f"Failed to get tx receipt for {tx_hash}: {e}")
        return {"verified": False, "status": "not_found", "error": "Transaction not found on BSC. It may still be pending."}

    if receipt is None:
        return {"verified": False, "status": "pending", "error": "Transaction not yet confirmed on BSC"}

    if receipt["status"] != 1:
        return {"verified": False, "status": "failed", "error": "Transaction failed on-chain"}

    # Parse logs for USDT Transfer event
    platform_addr_lower = platform_address.lower()
    usdt_addr_lower = USDT_CONTRACT_ADDRESS.lower()

    for log_entry in receipt["logs"]:
        # Must be from USDT contract
        if log_entry["address"].lower() != usdt_addr_lower:
            continue

        topics = log_entry["topics"]
        if len(topics) < 3:
            continue

        # Check Transfer event topic
        if topics[0].hex() != TRANSFER_EVENT_TOPIC:
            continue

        # Decode 'to' address from topic[2] (padded to 32 bytes)
        to_address = "0x" + topics[2].hex()[-40:]

        if to_address.lower() != platform_addr_lower:
            continue

        # Decode amount from data
        amount_raw = int(log_entry["data"].hex(), 16)
        amount_on_chain = Decimal(amount_raw) / Decimal(10 ** USDT_DECIMALS)

        from_address = "0x" + topics[1].hex()[-40:]

        if amount_on_chain >= expected_amount:
            return {
                "verified": True,
                "status": "confirmed",
                "amount": float(amount_on_chain),
                "from_address": Web3.to_checksum_address(from_address),
                "to_address": Web3.to_checksum_address(to_address),
                "block_number": receipt["blockNumber"],
                "confirmations": w3.eth.block_number - receipt["blockNumber"],
            }
        else:
            return {
                "verified": False,
                "status": "amount_mismatch",
                "error": f"Amount mismatch: on-chain {float(amount_on_chain)} USDT, expected {float(expected_amount)} USDT",
                "actual_amount": float(amount_on_chain),
            }

    return {
        "verified": False,
        "status": "no_transfer",
        "error": "No USDT transfer to platform address found in this transaction",
    }


def _send_usdt_sync(to_address: str, amount: Decimal) -> dict:
    """Synchronous USDT transfer from hot wallet (runs in thread pool)."""
    if not settings.HOT_WALLET_PRIVATE_KEY:
        return {"success": False, "error": "Hot wallet private key not configured"}

    if not settings.HOT_WALLET_ADDRESS:
        return {"success": False, "error": "Hot wallet address not configured"}

    w3 = _get_web3()

    try:
        from_addr = Web3.to_checksum_address(settings.HOT_WALLET_ADDRESS)
        to_addr = Web3.to_checksum_address(to_address)
        amount_wei = int(amount * Decimal(10 ** USDT_DECIMALS))

        usdt = w3.eth.contract(
            address=Web3.to_checksum_address(USDT_CONTRACT_ADDRESS),
            abi=USDT_ABI,
        )

        # Check hot wallet USDT balance
        balance = usdt.functions.balanceOf(from_addr).call()
        if balance < amount_wei:
            return {
                "success": False,
                "error": f"Insufficient hot wallet USDT balance. Available: {balance / (10 ** USDT_DECIMALS):.2f}",
            }

        # Check BNB balance for gas
        bnb_balance = w3.eth.get_balance(from_addr)
        if bnb_balance < w3.to_wei(0.001, "ether"):
            return {"success": False, "error": "Insufficient BNB for gas fees in hot wallet"}

        # Build transfer transaction
        nonce = w3.eth.get_transaction_count(from_addr)
        tx = usdt.functions.transfer(to_addr, amount_wei).build_transaction({
            "from": from_addr,
            "nonce": nonce,
            "gas": 100000,
            "gasPrice": w3.eth.gas_price,
            "chainId": BSC_CHAIN_ID,
        })

        # Sign and send
        signed = w3.eth.account.sign_transaction(tx, settings.HOT_WALLET_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

        # Wait for confirmation
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        if receipt["status"] == 1:
            logger.info(f"USDT sent: {float(amount)} to {to_address}, tx: {tx_hash.hex()}")
            return {"success": True, "tx_hash": tx_hash.hex()}
        else:
            logger.error(f"USDT transfer failed on-chain: {tx_hash.hex()}")
            return {"success": False, "error": "Transaction failed on-chain", "tx_hash": tx_hash.hex()}

    except Exception as e:
        logger.error(f"USDT transfer error: {e}")
        return {"success": False, "error": str(e)}


def _get_hot_wallet_balance_sync() -> dict:
    """Get USDT and BNB balances of hot wallet."""
    if not settings.HOT_WALLET_ADDRESS:
        return {"usdt_balance": 0, "bnb_balance": 0}

    w3 = _get_web3()
    addr = Web3.to_checksum_address(settings.HOT_WALLET_ADDRESS)

    usdt = w3.eth.contract(
        address=Web3.to_checksum_address(USDT_CONTRACT_ADDRESS),
        abi=USDT_ABI,
    )
    usdt_balance = usdt.functions.balanceOf(addr).call()
    bnb_balance = w3.eth.get_balance(addr)

    return {
        "usdt_balance": float(Decimal(usdt_balance) / Decimal(10 ** USDT_DECIMALS)),
        "bnb_balance": float(w3.from_wei(bnb_balance, "ether")),
    }


# ============ Async wrappers (run sync web3 calls in thread pool) ============

async def verify_deposit(
    tx_hash: str, expected_amount: Decimal, platform_address: str
) -> dict:
    """Verify a BSC USDT deposit transaction."""
    return await asyncio.to_thread(
        _verify_deposit_sync, tx_hash, expected_amount, platform_address
    )


async def send_usdt(to_address: str, amount: Decimal) -> dict:
    """Send USDT BEP-20 from hot wallet to an address."""
    return await asyncio.to_thread(_send_usdt_sync, to_address, amount)


async def get_hot_wallet_balance() -> dict:
    """Get hot wallet USDT and BNB balances."""
    return await asyncio.to_thread(_get_hot_wallet_balance_sync)
