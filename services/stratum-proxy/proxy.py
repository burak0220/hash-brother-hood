#!/usr/bin/env python3
"""
HashBrotherHood — Stratum Mining Proxy

Single TCP server on port 3333.
- Miner connects with worker name: username.rigId  (e.g., turanb047.12)
- Proxy looks up active rental for rig 12 via platform API
- Connects to renter's configured pool (or owner's fallback if idle)
- Replaces worker credentials transparently
- Counts shares + tracks difficulty → calculates real hashrate
- Reports to platform API every REPORT_INTERVAL seconds
"""

import asyncio
import json
import logging
import os
import re
import time
from collections import defaultdict
from typing import Optional

import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("stratum-proxy")

# ── Configuration ──────────────────────────────────────────────────────────────
API_BASE          = os.getenv("API_BASE_URL", "http://api:8000")
INTERNAL_API_KEY  = os.getenv("INTERNAL_API_KEY", "")
PROXY_HOST        = os.getenv("PROXY_HOST", "0.0.0.0")
PROXY_PORT        = int(os.getenv("PROXY_PORT", "3333"))
REPORT_INTERVAL   = int(os.getenv("HASHRATE_REPORT_INTERVAL", "300"))   # seconds
POOL_LOOKUP_CACHE = int(os.getenv("POOL_LOOKUP_CACHE_SEC", "60"))        # cache pool config

# Stratum URL patterns
_STRATUM_RE = re.compile(r"(?:stratum\+tcp://)?([^:]+):(\d+)", re.I)


def parse_stratum_url(url: str) -> tuple[str, int]:
    """Parse 'stratum+tcp://host:port' → (host, port)."""
    m = _STRATUM_RE.match(url.strip())
    if not m:
        raise ValueError(f"Cannot parse pool URL: {url!r}")
    return m.group(1), int(m.group(2))


# ── Per-rig share / difficulty tracking ────────────────────────────────────────
class RigTracker:
    """Accumulates share data for one rig across all its miner connections."""

    def __init__(self, rig_id: int):
        self.rig_id        = rig_id
        self.accepted      = 0
        self.rejected      = 0
        self.difficulty    = 1.0          # updated by mining.set_difficulty
        self.window_start  = time.time()

    def share_accepted(self):
        self.accepted += 1

    def share_rejected(self):
        self.rejected += 1

    def set_difficulty(self, diff: float):
        self.difficulty = float(diff)

    def flush(self) -> dict:
        """Return current stats and reset counters."""
        elapsed  = max(time.time() - self.window_start, 1)
        total    = self.accepted + self.rejected
        # Hashrate ≈ accepted_shares * difficulty * 2^32 / elapsed_seconds
        hashrate = (self.accepted * self.difficulty * 4_294_967_296) / elapsed if self.accepted else 0.0
        data = {
            "rig_id":          self.rig_id,
            "accepted_shares": self.accepted,
            "rejected_shares": self.rejected,
            "total_shares":    total,
            "elapsed_seconds": elapsed,
            "current_diff":    self.difficulty,
            "measured_hashrate": hashrate,   # in H/s
        }
        self.accepted     = 0
        self.rejected     = 0
        self.window_start = time.time()
        return data


_trackers: dict[int, RigTracker] = {}

def get_tracker(rig_id: int) -> RigTracker:
    if rig_id not in _trackers:
        _trackers[rig_id] = RigTracker(rig_id)
    return _trackers[rig_id]


# ── Pool config cache ───────────────────────────────────────────────────────────
_pool_cache: dict[int, tuple[dict, float]] = {}   # rig_id → (config, timestamp)

async def get_pool_config(rig_id: int) -> Optional[dict]:
    """
    Fetch pool config for a rig from the platform API.
    Returns rental pool if active, otherwise owner's fallback pool.
    Caches result for POOL_LOOKUP_CACHE seconds.
    """
    cached = _pool_cache.get(rig_id)
    if cached and (time.time() - cached[1]) < POOL_LOOKUP_CACHE:
        return cached[0]

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{API_BASE}/api/v1/internal/rig/{rig_id}/pool-config",
                headers={"X-Internal-Key": INTERNAL_API_KEY},
            )
            if resp.status_code == 200:
                data = resp.json()
                _pool_cache[rig_id] = (data, time.time())
                return data
            logger.warning(f"Rig {rig_id}: pool-config returned {resp.status_code}")
            return None
    except Exception as e:
        logger.error(f"Rig {rig_id}: pool-config lookup failed: {e}")
        return None


async def report_hashrates():
    """Periodically report share counts to the platform API."""
    while True:
        await asyncio.sleep(REPORT_INTERVAL)
        for rig_id, tracker in list(_trackers.items()):
            if tracker.accepted == 0 and tracker.rejected == 0:
                continue
            data = tracker.flush()
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.post(
                        f"{API_BASE}/api/v1/internal/hashrate-report",
                        json=data,
                        headers={"X-Internal-Key": INTERNAL_API_KEY},
                    )
                    if resp.status_code == 200:
                        logger.info(
                            f"Rig {rig_id}: reported {data['accepted_shares']} accepted shares, "
                            f"~{data['measured_hashrate']/1e9:.2f} GH/s"
                        )
                    else:
                        logger.warning(f"Rig {rig_id}: hashrate-report returned {resp.status_code}")
            except Exception as e:
                logger.error(f"Rig {rig_id}: hashrate report failed: {e}")


# ── Miner ↔ Pool connection handler ────────────────────────────────────────────
class MinerConnection:
    """
    Handles one miner TCP connection.
    - Buffers messages until mining.authorize to determine rig_id
    - Connects upstream to the correct pool
    - Proxies JSON-RPC lines bidirectionally
    - Updates tracker on share responses / difficulty changes
    """

    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        self.miner_r  = reader
        self.miner_w  = writer
        self.pool_r:  Optional[asyncio.StreamReader] = None
        self.pool_w:  Optional[asyncio.StreamWriter] = None
        self.rig_id:  Optional[int] = None
        self.tracker: Optional[RigTracker] = None
        # Track pending submit IDs → share result
        self._pending_submits: set[int] = set()
        self._alive = True

    # ── Handshake ──────────────────────────────────────────────────────────────
    async def run(self):
        peer = self.miner_w.get_extra_info("peername")
        logger.info(f"Miner connected: {peer}")
        try:
            await self._do_proxy()
        except Exception as e:
            logger.debug(f"Miner {peer} connection ended: {e}")
        finally:
            self._close_all()

    async def _do_proxy(self):
        # Step 1: Buffer messages until we see mining.authorize
        buffer: list[bytes] = []
        authorized = False

        for _ in range(30):  # max 30 lines before auth
            line = await asyncio.wait_for(self.miner_r.readline(), timeout=60.0)
            if not line:
                return
            buffer.append(line)
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue

            if msg.get("method") == "mining.authorize":
                worker = (msg.get("params") or [""])[0]
                self.rig_id = self._parse_rig_id(worker)
                if self.rig_id is None:
                    await self._reject(msg.get("id"), "Invalid worker format. Use username.rigId")
                    return
                authorized = True
                break

        if not authorized:
            logger.warning("Miner sent no mining.authorize, closing")
            return

        # Step 2: Fetch pool config for this rig
        cfg = await get_pool_config(self.rig_id)
        if not cfg or not cfg.get("pool_url"):
            await self._reject(None, "No pool configured for this rig")
            return

        # Step 3: Connect to upstream pool
        try:
            host, port = parse_stratum_url(cfg["pool_url"])
            self.pool_r, self.pool_w = await asyncio.open_connection(host, port)
        except Exception as e:
            logger.error(f"Rig {self.rig_id}: upstream connect failed: {e}")
            await self._reject(None, "Could not connect to mining pool")
            return

        self.tracker = get_tracker(self.rig_id)
        upstream_user = cfg.get("pool_user", "")
        upstream_pass = cfg.get("pool_password", "x") or "x"
        rental_id     = cfg.get("rental_id")

        logger.info(f"Rig {self.rig_id} (rental={rental_id}): upstream {host}:{port}")

        # Step 4: Replay buffered messages to pool (replacing credentials)
        for raw in buffer:
            try:
                msg = json.loads(raw)
                if msg.get("method") == "mining.authorize":
                    msg["params"] = [upstream_user, upstream_pass]
                    raw = (json.dumps(msg) + "\n").encode()
                elif msg.get("method") == "mining.submit":
                    params = msg.get("params", [])
                    if params:
                        params[0] = upstream_user
                    raw = (json.dumps(msg) + "\n").encode()
                    self._pending_submits.add(msg.get("id"))
            except json.JSONDecodeError:
                pass
            self.pool_w.write(raw)
        await self.pool_w.drain()

        # Step 5: Proxy both directions concurrently
        await asyncio.gather(
            self._forward_miner_to_pool(upstream_user),
            self._forward_pool_to_miner(),
            return_exceptions=True,
        )

    # ── Bidirectional forwarding ───────────────────────────────────────────────
    async def _forward_miner_to_pool(self, upstream_user: str):
        while self._alive:
            line = await self.miner_r.readline()
            if not line:
                break
            try:
                msg = json.loads(line)
                method = msg.get("method", "")

                if method == "mining.submit":
                    # Replace worker name in submit params
                    params = msg.get("params", [])
                    if params:
                        params[0] = upstream_user
                    self._pending_submits.add(msg.get("id"))
                    line = (json.dumps(msg) + "\n").encode()

                elif method == "mining.authorize":
                    # Re-auth with upstream creds
                    msg["params"] = [upstream_user, "x"]
                    line = (json.dumps(msg) + "\n").encode()

            except json.JSONDecodeError:
                pass
            self.pool_w.write(line)
            await self.pool_w.drain()

    async def _forward_pool_to_miner(self):
        while self._alive:
            line = await self.pool_r.readline()
            if not line:
                break
            try:
                msg = json.loads(line)

                # Track share results
                mid = msg.get("id")
                if mid in self._pending_submits:
                    self._pending_submits.discard(mid)
                    if msg.get("result") is True:
                        self.tracker.share_accepted()
                    else:
                        self.tracker.share_rejected()

                # Track difficulty changes
                elif msg.get("method") == "mining.set_difficulty":
                    params = msg.get("params", [])
                    if params:
                        try:
                            self.tracker.set_difficulty(float(params[0]))
                        except (ValueError, TypeError):
                            pass

            except json.JSONDecodeError:
                pass
            self.miner_w.write(line)
            await self.miner_w.drain()

    # ── Helpers ────────────────────────────────────────────────────────────────
    @staticmethod
    def _parse_rig_id(worker: str) -> Optional[int]:
        """Parse 'username.rigId' → rig_id int, or None."""
        if not worker or "." not in worker:
            return None
        try:
            return int(worker.rsplit(".", 1)[1])
        except (ValueError, IndexError):
            return None

    async def _reject(self, msg_id, reason: str):
        err = json.dumps({"id": msg_id, "result": None, "error": [24, reason, None]}) + "\n"
        try:
            self.miner_w.write(err.encode())
            await self.miner_w.drain()
        except Exception:
            pass

    def _close_all(self):
        self._alive = False
        for w in (self.miner_w, self.pool_w):
            if w:
                try:
                    w.close()
                except Exception:
                    pass


# ── Server entry point ─────────────────────────────────────────────────────────
async def handle_miner(reader, writer):
    conn = MinerConnection(reader, writer)
    await conn.run()


async def main():
    logger.info(f"HashBrotherHood Stratum Proxy v2")
    logger.info(f"Listening on {PROXY_HOST}:{PROXY_PORT}")
    logger.info(f"API: {API_BASE} | Report interval: {REPORT_INTERVAL}s")

    server = await asyncio.start_server(handle_miner, PROXY_HOST, PROXY_PORT)

    # Background hashrate reporter
    asyncio.create_task(report_hashrates())

    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
