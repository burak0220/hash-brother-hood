"""
HD Wallet service for generating unique deposit addresses for each user.

Uses BIP44 standard: m/44'/60'/0'/0/{index}
- 44: BIP44 purpose
- 60: Ethereum/BSC coin type
- 0: Account 0
- 0: External chain (receiving addresses)
- index: User-specific index (typically user_id)
"""
import logging
from eth_account import Account
from eth_account.hdaccount import generate_mnemonic, seed_from_mnemonic, key_from_seed

from app.core.config import settings

logger = logging.getLogger(__name__)

# BIP44 path for BSC (same as Ethereum, coin type 60)
# m/44'/60'/0'/0/{index}
BIP44_PATH_TEMPLATE = "m/44'/60'/0'/0/{}"


def generate_new_mnemonic() -> str:
    """Generate a new BIP39 mnemonic (12 words)."""
    return generate_mnemonic(num_words=12, lang="english")


def derive_address_from_index(index: int) -> tuple[str, str]:
    """
    Derive BSC address and private key from HD wallet index.

    Args:
        index: The derivation index (typically user_id)

    Returns:
        Tuple of (address, private_key_hex)

    Raises:
        ValueError: If HD_WALLET_MNEMONIC is not configured
    """
    if not settings.HD_WALLET_MNEMONIC:
        raise ValueError("HD_WALLET_MNEMONIC not configured in environment")

    # Derive BIP44 path
    path = BIP44_PATH_TEMPLATE.format(index)

    # Generate seed from mnemonic
    seed = seed_from_mnemonic(settings.HD_WALLET_MNEMONIC, passphrase="")

    # Derive key from seed and path
    private_key = key_from_seed(seed, path)

    # Create account from private key
    account = Account.from_key(private_key)

    return account.address, account.key.hex()


def derive_address_only(index: int) -> str:
    """
    Derive only the BSC address (without private key).
    Faster and safer for address generation.

    Args:
        index: The derivation index (typically user_id)

    Returns:
        BSC address (0x...)
    """
    address, _ = derive_address_from_index(index)
    return address


def derive_private_key(index: int) -> str:
    """
    Derive the private key for a specific index.
    Use with caution - only call when needed for withdrawals.

    Args:
        index: The derivation index (typically user_id)

    Returns:
        Private key hex string
    """
    _, private_key = derive_address_from_index(index)
    return private_key


def validate_mnemonic(mnemonic: str) -> bool:
    """
    Validate if a mnemonic is valid BIP39.

    Args:
        mnemonic: Space-separated mnemonic words

    Returns:
        True if valid, False otherwise
    """
    try:
        seed_from_mnemonic(mnemonic, passphrase="")
        return True
    except Exception as e:
        logger.warning(f"Invalid mnemonic: {e}")
        return False


if __name__ == "__main__":
    # Test/demo code - generate a new mnemonic and derive some addresses
    print("=== HD Wallet Demo ===\n")

    # Generate new mnemonic
    new_mnemonic = generate_new_mnemonic()
    print(f"New Mnemonic (SAVE THIS SECURELY!):\n{new_mnemonic}\n")

    # Derive first 5 addresses
    print("First 5 derived addresses:")
    for i in range(5):
        # Temporarily set mnemonic for demo
        original = settings.HD_WALLET_MNEMONIC
        settings.HD_WALLET_MNEMONIC = new_mnemonic

        address = derive_address_only(i)
        print(f"  Index {i}: {address}")

        settings.HD_WALLET_MNEMONIC = original
