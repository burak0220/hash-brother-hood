"""
HD Wallet service for generating unique LTC deposit addresses for each user.

Uses BIP44 standard: m/44'/2'/0'/0/{index}
- 44: BIP44 purpose
- 2: Litecoin coin type
- 0: Account 0
- 0: External chain (receiving addresses)
- index: User-specific index (typically user_id)

Pure Python implementation — no external crypto libraries required.
"""
import hashlib
import hmac
import logging
import struct

from app.core.config import settings

# secp256k1 curve parameters
_SECP256K1_P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
_SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
_SECP256K1_Gx = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
_SECP256K1_Gy = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8


def _point_add(P: tuple | None, Q: tuple | None) -> tuple | None:
    """Add two secp256k1 elliptic curve points."""
    if P is None:
        return Q
    if Q is None:
        return P
    px, py = P
    qx, qy = Q
    if px == qx:
        if py != qy:
            return None  # point at infinity
        # Point doubling
        lam = (3 * px * px * pow(2 * py, _SECP256K1_P - 2, _SECP256K1_P)) % _SECP256K1_P
    else:
        lam = ((qy - py) * pow(qx - px, _SECP256K1_P - 2, _SECP256K1_P)) % _SECP256K1_P
    rx = (lam * lam - px - qx) % _SECP256K1_P
    ry = (lam * (px - rx) - py) % _SECP256K1_P
    return (rx, ry)


def _point_mul(k: int, P: tuple) -> tuple | None:
    """Scalar multiplication on secp256k1 (double-and-add)."""
    result = None
    addend = P
    while k:
        if k & 1:
            result = _point_add(result, addend)
        addend = _point_add(addend, addend)
        k >>= 1
    return result

logger = logging.getLogger(__name__)

# BIP44 path for Litecoin (coin type 2)
BIP44_PATH_TEMPLATE = "m/44'/2'/0'/0/{}"

# Bech32 encoding for ltc1... addresses
BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"


def _bech32_polymod(values: list[int]) -> int:
    GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
    chk = 1
    for v in values:
        b = chk >> 25
        chk = ((chk & 0x1FFFFFF) << 5) ^ v
        for i in range(5):
            chk ^= GEN[i] if ((b >> i) & 1) else 0
    return chk


def _bech32_hrp_expand(hrp: str) -> list[int]:
    return [ord(x) >> 5 for x in hrp] + [0] + [ord(x) & 31 for x in hrp]


def _bech32_create_checksum(hrp: str, data: list[int]) -> list[int]:
    values = _bech32_hrp_expand(hrp) + data
    polymod = _bech32_polymod(values + [0, 0, 0, 0, 0, 0]) ^ 1
    return [(polymod >> 5 * (5 - i)) & 31 for i in range(6)]


def _convertbits(data: bytes, frombits: int, tobits: int, pad: bool = True) -> list[int]:
    acc = 0
    bits = 0
    ret = []
    maxv = (1 << tobits) - 1
    for value in data:
        acc = (acc << frombits) | value
        bits += frombits
        while bits >= tobits:
            bits -= tobits
            ret.append((acc >> bits) & maxv)
    if pad:
        if bits:
            ret.append((acc << (tobits - bits)) & maxv)
    elif bits >= frombits or ((acc << (tobits - bits)) & maxv):
        return []
    return ret


def _bech32_encode(hrp: str, witver: int, witprog: bytes) -> str:
    five_bit = _convertbits(witprog, 8, 5)
    data = [witver] + five_bit
    checksum = _bech32_create_checksum(hrp, data)
    return hrp + "1" + "".join(BECH32_CHARSET[d] for d in data + checksum)


def _parse_path(path: str) -> list[int]:
    """Parse BIP44 derivation path string to list of child indices."""
    parts = path.replace("m/", "").split("/")
    result = []
    for part in parts:
        hardened = part.endswith("'")
        index = int(part.rstrip("'"))
        if hardened:
            index += 0x80000000
        result.append(index)
    return result


def _hmac_sha512(key: bytes, data: bytes) -> bytes:
    return hmac.new(key, data, hashlib.sha512).digest()


def _serialize_curve_point(private_key_bytes: bytes) -> bytes:
    """Derive compressed public key from private key using secp256k1 (pure Python)."""
    G = (_SECP256K1_Gx, _SECP256K1_Gy)
    k = int.from_bytes(private_key_bytes, 'big')
    point = _point_mul(k, G)
    if point is None:
        raise ValueError("Invalid private key: resulted in point at infinity")
    x, y = point
    prefix = b'\x02' if y % 2 == 0 else b'\x03'
    return prefix + x.to_bytes(32, 'big')


def _derive_child(parent_key: bytes, parent_chain: bytes, index: int) -> tuple[bytes, bytes]:
    """Derive a child key from parent using BIP32."""
    if index >= 0x80000000:
        # Hardened derivation
        data = b'\x00' + parent_key + struct.pack('>I', index)
    else:
        # Normal derivation
        pubkey = _serialize_curve_point(parent_key)
        data = pubkey + struct.pack('>I', index)

    I = _hmac_sha512(parent_chain, data)
    IL, IR = I[:32], I[32:]

    # secp256k1 order
    order = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
    key_int = (int.from_bytes(IL, 'big') + int.from_bytes(parent_key, 'big')) % order
    child_key = key_int.to_bytes(32, 'big')

    return child_key, IR


def _mnemonic_to_seed(mnemonic: str, passphrase: str = "") -> bytes:
    """Convert BIP39 mnemonic to seed."""
    password = mnemonic.encode('utf-8')
    salt = ("mnemonic" + passphrase).encode('utf-8')
    return hashlib.pbkdf2_hmac('sha512', password, salt, 2048)


def _seed_to_master_key(seed: bytes) -> tuple[bytes, bytes]:
    """Derive master key and chain code from seed using BIP32."""
    I = _hmac_sha512(b"Bitcoin seed", seed)
    return I[:32], I[32:]


def _private_key_to_wif(private_key: bytes, network: str = "mainnet") -> str:
    """Convert private key bytes to WIF format."""
    if network == "mainnet":
        prefix = b'\xb0'  # Litecoin mainnet
    else:
        prefix = b'\xef'  # Testnet

    extended = prefix + private_key + b'\x01'  # 0x01 = compressed
    checksum = hashlib.sha256(hashlib.sha256(extended).digest()).digest()[:4]
    import base58
    return base58.b58encode(extended + checksum).decode()


def _pubkey_to_ltc_bech32(pubkey_bytes: bytes, network: str = "mainnet") -> str:
    """Convert compressed public key to ltc1... bech32 address."""
    sha256_hash = hashlib.sha256(pubkey_bytes).digest()
    ripemd160 = hashlib.new('ripemd160', sha256_hash).digest()
    hrp = "ltc" if network == "mainnet" else "tltc"
    return _bech32_encode(hrp, 0, ripemd160)


def derive_address_from_index(index: int) -> tuple[str, str]:
    """
    Derive LTC address and private key (WIF) from HD wallet index.

    Args:
        index: The derivation index (typically user_id)

    Returns:
        Tuple of (ltc_address, private_key_wif)
    """
    if not settings.HD_WALLET_MNEMONIC:
        raise ValueError("HD_WALLET_MNEMONIC not configured in environment")

    path = BIP44_PATH_TEMPLATE.format(index)
    seed = _mnemonic_to_seed(settings.HD_WALLET_MNEMONIC)
    master_key, master_chain = _seed_to_master_key(seed)

    # Derive through BIP44 path
    key, chain = master_key, master_chain
    for child_index in _parse_path(path):
        key, chain = _derive_child(key, chain, child_index)

    # Generate address
    pubkey = _serialize_curve_point(key)
    network = settings.LTC_NETWORK
    address = _pubkey_to_ltc_bech32(pubkey, network)
    wif = _private_key_to_wif(key, network)

    return address, wif


def derive_address_only(index: int) -> str:
    """
    Derive only the LTC address (without private key).

    Args:
        index: The derivation index (typically user_id)

    Returns:
        LTC address (ltc1... or tltc1...)
    """
    address, _ = derive_address_from_index(index)
    return address


def derive_private_key(index: int) -> str:
    """
    Derive the private key (WIF) for a specific index.

    Args:
        index: The derivation index (typically user_id)

    Returns:
        Private key in WIF format
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
        words = mnemonic.strip().split()
        if len(words) not in (12, 15, 18, 21, 24):
            return False
        # Try to derive seed - will fail if mnemonic is invalid
        _mnemonic_to_seed(mnemonic)
        return True
    except Exception as e:
        logger.warning(f"Invalid mnemonic: {e}")
        return False
