"""
Litecoin blockchain service using Blockchair public API.
No local LTC node required.

- UTXO queries  : Blockchair REST API
- TX signing    : Pure Python BIP143 (P2WPKH SegWit)
- Broadcasting  : Blockchair push/transaction
"""
import asyncio
import hashlib
import hmac as _hmac
import logging
import struct
from decimal import Decimal

import httpx

from app.core.config import settings
from app.services.hdwallet import (
    _SECP256K1_Gx, _SECP256K1_Gy, _SECP256K1_N,
    _point_mul, _serialize_curve_point,
)

logger = logging.getLogger(__name__)

SATOSHI = Decimal("0.00000001")
SATS = 100_000_000  # satoshis per LTC
DEFAULT_FEE_RATE = 10  # sat/vByte fallback


# ─── BlockCypher API ──────────────────────────────────────────────────────────
# Free tier: ~200 req/hour without API key, more with token.
# Supports LTC mainnet. Token configurable via BLOCKCYPHER_TOKEN env var.

def _bcy_base() -> str:
    # BlockCypher only supports LTC mainnet
    return "https://api.blockcypher.com/v1/ltc/main"

def _bcy_params() -> dict:
    token = getattr(settings, "BLOCKCYPHER_TOKEN", "")
    return {"token": token} if token else {}

def _bcy_get(path: str, **params) -> dict:
    """GET request with automatic retry on 429 (rate limit)."""
    url    = _bcy_base() + path
    merged = {**_bcy_params(), **params}
    for attempt in range(3):
        resp = httpx.get(url, params=merged, timeout=15.0)
        if resp.status_code == 429:
            wait = 2 ** attempt  # 1s, 2s, 4s
            import time; time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.json()
    # Final attempt — raise if still 429
    resp.raise_for_status()
    return resp.json()

def _bcy_post(path: str, body: dict) -> dict:
    url    = _bcy_base() + path
    params = _bcy_params()
    resp   = httpx.post(url, json=body, params=params, timeout=15.0)
    resp.raise_for_status()
    return resp.json()


# ─── Crypto helpers ───────────────────────────────────────────────────────────

def _sha256(b: bytes) -> bytes:
    return hashlib.sha256(b).digest()

def _hash256(b: bytes) -> bytes:
    return _sha256(_sha256(b))

def _hash160(b: bytes) -> bytes:
    return hashlib.new("ripemd160", _sha256(b)).digest()

def _varint(n: int) -> bytes:
    if n < 0xfd:      return bytes([n])
    if n <= 0xffff:   return b"\xfd" + struct.pack("<H", n)
    if n <= 0xffffffff: return b"\xfe" + struct.pack("<I", n)
    return b"\xff" + struct.pack("<Q", n)


def _wif_to_privkey(wif: str) -> bytes:
    """WIF → raw 32-byte private key."""
    import base58
    decoded = base58.b58decode(wif)
    return decoded[1:33]


# ─── ECDSA / RFC6979 ─────────────────────────────────────────────────────────

def _rfc6979_k(d: int, z: int) -> int:
    """Deterministic k per RFC6979."""
    n = _SECP256K1_N
    bx = d.to_bytes(32, "big") + z.to_bytes(32, "big")
    v = b"\x01" * 32
    k = b"\x00" * 32
    k = _hmac.new(k, v + b"\x00" + bx, hashlib.sha256).digest()
    v = _hmac.new(k, v, hashlib.sha256).digest()
    k = _hmac.new(k, v + b"\x01" + bx, hashlib.sha256).digest()
    v = _hmac.new(k, v, hashlib.sha256).digest()
    while True:
        v = _hmac.new(k, v, hashlib.sha256).digest()
        cand = int.from_bytes(v, "big")
        if 1 <= cand < n:
            return cand
        k = _hmac.new(k, v + b"\x00", hashlib.sha256).digest()
        v = _hmac.new(k, v, hashlib.sha256).digest()


def _ecdsa_sign(privkey: bytes, msg_hash: bytes) -> tuple[int, int]:
    """ECDSA sign, returns low-s (r, s)."""
    n = _SECP256K1_N
    G = (_SECP256K1_Gx, _SECP256K1_Gy)
    d = int.from_bytes(privkey, "big")
    z = int.from_bytes(msg_hash, "big")
    k = _rfc6979_k(d, z)
    rx = _point_mul(k, G)[0] % n
    s  = pow(k, n - 2, n) * (z + rx * d) % n
    if s > n // 2:
        s = n - s
    return rx, s


def _der_encode(r: int, s: int) -> bytes:
    """DER-encode an ECDSA (r, s) pair."""
    def enc(v: int) -> bytes:
        b = v.to_bytes((v.bit_length() + 7) // 8, "big")
        if b[0] & 0x80:
            b = b"\x00" + b
        return bytes([0x02, len(b)]) + b
    inner = enc(r) + enc(s)
    return bytes([0x30, len(inner)]) + inner


# ─── Bech32 decode ────────────────────────────────────────────────────────────

_BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"

def _bech32_decode_hash160(address: str) -> bytes:
    """Extract 20-byte hash160 from a P2WPKH bech32 address."""
    pos = address.rfind("1")
    if pos < 1:
        raise ValueError(f"Invalid bech32: {address}")
    data_str = address[pos + 1:]
    vals = []
    for c in data_str:
        idx = _BECH32_CHARSET.find(c.lower())
        if idx < 0:
            raise ValueError(f"Invalid char in bech32: {c}")
        vals.append(idx)
    # vals[0] = witness version, vals[1:-6] = 5-bit data, vals[-6:] = checksum
    five_bits = vals[1:-6]
    acc, bits, out = 0, 0, []
    for val in five_bits:
        acc = (acc << 5) | val
        bits += 5
        while bits >= 8:
            bits -= 8
            out.append((acc >> bits) & 0xFF)
    return bytes(out)  # 20 bytes


def _p2wpkh_scriptpubkey(address: str) -> bytes:
    """OP_0 <20-byte-hash> scriptPubKey from a bech32 address."""
    h160 = _bech32_decode_hash160(address)
    return bytes([0x00, 0x14]) + h160  # OP_0 PUSH20


# ─── BIP143 P2WPKH transaction signing ───────────────────────────────────────

def _build_and_sign_tx(
    inputs: list[dict],   # [{txid, vout, value_sat, wif_key}]
    outputs: list[dict],  # [{address, value_sat}]
) -> str:
    """
    Build and sign a SegWit P2WPKH transaction.
    Returns signed transaction as hex string.
    """
    version   = struct.pack("<I", 1)
    locktime  = struct.pack("<I", 0)
    sequence  = b"\xff\xff\xff\xff"
    sighash_t = struct.pack("<I", 1)  # SIGHASH_ALL

    # Derive keys for each input
    privkeys = [_wif_to_privkey(u["wif_key"]) for u in inputs]
    pubkeys  = [_serialize_curve_point(pk) for pk in privkeys]
    h160s    = [_hash160(pk) for pk in pubkeys]

    # BIP143 hashes
    prevouts = b"".join(
        bytes.fromhex(u["txid"])[::-1] + struct.pack("<I", u["vout"])
        for u in inputs
    )
    hash_prevouts = _hash256(prevouts)
    hash_sequence = _hash256(sequence * len(inputs))

    out_data = b"".join(
        struct.pack("<Q", o["value_sat"]) +
        _varint(len(_p2wpkh_scriptpubkey(o["address"]))) +
        _p2wpkh_scriptpubkey(o["address"])
        for o in outputs
    )
    hash_outputs = _hash256(out_data)

    # Sign each input with BIP143
    witnesses = []
    for i, u in enumerate(inputs):
        outpoint   = bytes.fromhex(u["txid"])[::-1] + struct.pack("<I", u["vout"])
        scriptcode = bytes([0x19, 0x76, 0xa9, 0x14]) + h160s[i] + bytes([0x88, 0xac])
        value_b    = struct.pack("<Q", u["value_sat"])

        preimage = (
            version + hash_prevouts + hash_sequence +
            outpoint + scriptcode + value_b +
            sequence + hash_outputs + locktime + sighash_t
        )
        sighash = _hash256(preimage)
        r, s    = _ecdsa_sign(privkeys[i], sighash)
        sig     = _der_encode(r, s) + b"\x01"  # SIGHASH_ALL byte
        witnesses.append((sig, pubkeys[i]))

    # Serialize SegWit transaction
    tx  = version
    tx += b"\x00\x01"  # marker + flag
    # Inputs (empty scriptSig)
    tx += _varint(len(inputs))
    for u in inputs:
        tx += bytes.fromhex(u["txid"])[::-1]
        tx += struct.pack("<I", u["vout"])
        tx += b"\x00"      # scriptSig length = 0
        tx += sequence
    # Outputs
    tx += _varint(len(outputs))
    for o in outputs:
        script = _p2wpkh_scriptpubkey(o["address"])
        tx += struct.pack("<Q", o["value_sat"])
        tx += _varint(len(script)) + script
    # Witness
    for sig, pubkey in witnesses:
        tx += b"\x02"
        tx += _varint(len(sig))    + sig
        tx += _varint(len(pubkey)) + pubkey
    tx += locktime

    return tx.hex()


# ─── Fee estimation ───────────────────────────────────────────────────────────

def _fee_rate_sat_per_vbyte() -> int:
    """Get recommended fee rate (sat/vByte). Uses hardcoded safe default."""
    return DEFAULT_FEE_RATE


def _estimate_fee_sat(n_inputs: int, n_outputs: int) -> int:
    """
    Estimate fee for a P2WPKH transaction.
    vSize ≈ 11 + 68*n_in + 31*n_out  (standard approximation)
    """
    vsize = 11 + 68 * n_inputs + 31 * n_outputs
    return vsize * _fee_rate_sat_per_vbyte()


# ─── UTXO queries ────────────────────────────────────────────────────────────

def _get_address_utxos_sync(address: str) -> list[dict]:
    """
    Query UTXOs for an address via BlockCypher.
    Returns list of {txid, vout, amount (LTC float), confirmations, value_sat}.
    """
    try:
        data   = _bcy_get(f"/addrs/{address}", unspentOnly="true", includeScript="true")
        txrefs = data.get("txrefs", [])
        result = []
        for u in txrefs:
            if u.get("spent", False):
                continue
            value_sat  = int(u["value"])
            amount_ltc = value_sat / SATS
            result.append({
                "txid":          u["tx_hash"],
                "vout":          u["tx_output_n"],
                "amount":        amount_ltc,
                "confirmations": int(u.get("confirmations", 0)),
                "value_sat":     value_sat,
            })
        return result
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return []  # Address exists but no txs yet — normal
        if e.response.status_code == 429:
            logger.debug(f"BlockCypher rate limit for {address}, will retry next cycle")
            return []
        logger.warning(f"UTXO query failed for {address}: {e}")
        return []
    except Exception as e:
        logger.error(f"UTXO query failed for {address}: {e}")
        return []


# ─── Sync implementations ─────────────────────────────────────────────────────

def _verify_deposit_sync(tx_hash: str, expected_amount: Decimal, to_address: str) -> dict:
    """Verify an LTC deposit via BlockCypher."""
    try:
        data  = _bcy_get(f"/txs/{tx_hash}")
        confs = int(data.get("confirmations", 0))
        for out in data.get("outputs", []):
            addrs = out.get("addresses", [])
            if to_address.lower() in [a.lower() for a in addrs]:
                on_chain = Decimal(str(out["value"])) / SATS
                if on_chain >= expected_amount:
                    return {
                        "verified":      True,
                        "status":        "confirmed",
                        "amount":        float(on_chain),
                        "to_address":    to_address,
                        "confirmations": confs,
                    }
                return {
                    "verified":      False,
                    "status":        "amount_mismatch",
                    "error":         f"On-chain {float(on_chain)} LTC, expected {float(expected_amount)} LTC",
                    "actual_amount": float(on_chain),
                }
        return {"verified": False, "status": "no_transfer",
                "error": "No LTC transfer to deposit address found."}
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"verified": False, "status": "not_found",
                    "error": "Transaction not found on Litecoin network."}
        logger.warning(f"Deposit verify failed for {tx_hash}: {e}")
        return {"verified": False, "status": "error", "error": str(e)}
    except Exception as e:
        logger.warning(f"Deposit verify failed for {tx_hash}: {e}")
        return {"verified": False, "status": "error", "error": str(e)}


def _get_hot_wallet_balance_sync() -> dict:
    if not settings.HOT_WALLET_ADDRESS:
        return {"ltc_balance": 0}
    try:
        utxos = _get_address_utxos_sync(settings.HOT_WALLET_ADDRESS)
        total = sum(u["amount"] for u in utxos)
        return {"ltc_balance": total}
    except Exception as e:
        logger.error(f"Hot wallet balance failed: {e}")
        return {"ltc_balance": 0}


def _send_ltc_sync(to_address: str, amount: Decimal) -> dict:
    """Send LTC from hot wallet to an address."""
    if not settings.HOT_WALLET_PRIVATE_KEY:
        return {"success": False, "error": "HOT_WALLET_PRIVATE_KEY not configured"}
    if not settings.HOT_WALLET_ADDRESS:
        return {"success": False, "error": "HOT_WALLET_ADDRESS not configured"}

    try:
        utxos = _get_address_utxos_sync(settings.HOT_WALLET_ADDRESS)
        # Only confirmed UTXOs
        utxos = [u for u in utxos if u["confirmations"] >= 1]
        if not utxos:
            return {"success": False, "error": "No confirmed UTXOs in hot wallet"}

        total_sat = sum(u["value_sat"] for u in utxos)
        amount_sat = int(amount * SATS)
        fee_sat    = _estimate_fee_sat(len(utxos), 2)  # 2 outputs: dest + change

        if total_sat < amount_sat + fee_sat:
            avail = total_sat / SATS
            return {"success": False,
                    "error": f"Insufficient balance. Available: {avail:.8f} LTC"}

        tx_inputs = [
            {"txid": u["txid"], "vout": u["vout"],
             "value_sat": u["value_sat"],
             "wif_key": settings.HOT_WALLET_PRIVATE_KEY}
            for u in utxos
        ]
        change_sat = total_sat - amount_sat - fee_sat
        tx_outputs = [{"address": to_address, "value_sat": amount_sat}]
        if change_sat > 546:  # dust limit
            tx_outputs.append({"address": settings.HOT_WALLET_ADDRESS,
                                "value_sat": change_sat})

        hex_tx = _build_and_sign_tx(tx_inputs, tx_outputs)
        result = _bcy_post("/txs/push", {"tx": hex_tx})
        txid   = result.get("tx", {}).get("hash", "")
        logger.info(f"Sent {float(amount)} LTC to {to_address}, tx: {txid}")
        return {"success": True, "tx_hash": txid}

    except Exception as e:
        logger.error(f"send_ltc failed: {e}")
        return {"success": False, "error": str(e)}


def _sweep_addresses_sync(
    address_key_pairs: list[tuple[str, str]], hot_wallet_address: str
) -> dict:
    """
    Sweep multiple deposit addresses to hot wallet in a single TX.
    address_key_pairs: list of (address, wif_private_key)
    """
    if not address_key_pairs:
        return {"success": False, "error": "No addresses provided"}

    try:
        min_conf   = settings.SWEEP_MIN_CONFIRMATIONS
        all_inputs = []
        total_sat  = 0

        for address, wif_key in address_key_pairs:
            utxos = _get_address_utxos_sync(address)
            for u in utxos:
                if u["confirmations"] >= min_conf:
                    all_inputs.append({
                        "txid":      u["txid"],
                        "vout":      u["vout"],
                        "value_sat": u["value_sat"],
                        "wif_key":   wif_key,
                    })
                    total_sat += u["value_sat"]

        if not all_inputs:
            return {"success": False, "error": "No UTXOs found to sweep"}

        fee_sat    = _estimate_fee_sat(len(all_inputs), 1)
        output_sat = total_sat - fee_sat

        if output_sat <= 546:
            return {"success": False, "error": "UTXOs too small to cover fee"}

        tx_outputs = [{"address": hot_wallet_address, "value_sat": output_sat}]
        hex_tx     = _build_and_sign_tx(all_inputs, tx_outputs)
        result     = _bcy_post("/txs/push", {"tx": hex_tx})
        txid       = result.get("tx", {}).get("hash", "")

        logger.info(
            f"Sweep: {len(all_inputs)} UTXOs → hot wallet "
            f"{output_sat/SATS:.8f} LTC (fee {fee_sat/SATS:.8f}), tx: {txid}"
        )
        return {
            "success":     True,
            "tx_hash":     txid,
            "total_swept": output_sat / SATS,
            "fee":         fee_sat / SATS,
            "utxo_count":  len(all_inputs),
        }

    except Exception as e:
        logger.error(f"Sweep failed: {e}")
        return {"success": False, "error": str(e)}


# ─── Async wrappers ───────────────────────────────────────────────────────────

async def verify_deposit(tx_hash: str, expected_amount: Decimal, to_address: str) -> dict:
    return await asyncio.to_thread(_verify_deposit_sync, tx_hash, expected_amount, to_address)

async def send_ltc(to_address: str, amount: Decimal) -> dict:
    return await asyncio.to_thread(_send_ltc_sync, to_address, amount)

async def get_hot_wallet_balance() -> dict:
    return await asyncio.to_thread(_get_hot_wallet_balance_sync)

async def get_address_utxos(address: str) -> list[dict]:
    return await asyncio.to_thread(_get_address_utxos_sync, address)

async def sweep_addresses(
    address_key_pairs: list[tuple[str, str]], hot_wallet_address: str
) -> dict:
    return await asyncio.to_thread(_sweep_addresses_sync, address_key_pairs, hot_wallet_address)

async def import_address(address: str, rescan: bool = False) -> bool:
    """No-op: API-based approach tracks any address without importing."""
    return True
