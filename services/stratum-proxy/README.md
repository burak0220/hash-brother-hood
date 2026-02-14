# Stratum Mining Proxy

Real-time hashrate monitoring through stratum proxy.

## How It Works

```
Rig → Proxy (localhost:3333) → Target Pool
        ↓
   Track submitted shares
        ↓
   Calculate hashrate
        ↓
   POST to /api/v1/internal/hashrate-update
```

## Implementation Options

### Option 1: Use existing solution (Recommended)
- **stratumproxy** (Node.js): https://github.com/sammy007/stratum-proxy
- **mining-proxy** (Go): https://github.com/sammy007/mining-proxy

### Option 2: Build custom (Python/Node.js)

#### Python Example:
```python
import asyncio
import json
from datetime import datetime

class StratumProxy:
    def __init__(self, rental_id, target_pool):
        self.rental_id = rental_id
        self.target_pool = target_pool
        self.shares_submitted = 0
        self.start_time = datetime.now()

    async def handle_miner(self, reader, writer):
        # Connect to real pool
        pool_reader, pool_writer = await asyncio.open_connection(
            self.target_pool['host'],
            self.target_pool['port']
        )

        # Relay traffic both ways
        await asyncio.gather(
            self.relay(reader, pool_writer, direction="miner_to_pool"),
            self.relay(pool_reader, writer, direction="pool_to_miner")
        )

    async def relay(self, reader, writer, direction):
        while True:
            data = await reader.read(4096)
            if not data:
                break

            # Parse stratum messages
            if direction == "miner_to_pool":
                message = json.loads(data)

                # Track share submissions
                if message.get("method") == "mining.submit":
                    self.shares_submitted += 1
                    self.calculate_hashrate()

            writer.write(data)
            await writer.drain()

    def calculate_hashrate(self):
        # Hashrate = (shares * difficulty) / time
        elapsed_seconds = (datetime.now() - self.start_time).total_seconds()
        if elapsed_seconds > 60:  # Calculate every minute
            hashrate = self.shares_submitted / elapsed_seconds
            self.report_hashrate(hashrate)
            # Reset for next interval
            self.shares_submitted = 0
            self.start_time = datetime.now()

    def report_hashrate(self, hashrate):
        # POST to API
        import httpx
        httpx.post(
            "http://api:8000/api/v1/internal/hashrate-update",
            json={
                "rental_id": self.rental_id,
                "hashrate": hashrate
            }
        )
```

### Option 3: Use Docker container

```yaml
# docker-compose.yml
services:
  stratum-proxy:
    image: sammy007/stratum-proxy
    ports:
      - "3333:3333"
    environment:
      - POOL_HOST=pool.hashrate.com
      - POOL_PORT=3333
      - API_URL=http://api:8000/api/v1/internal/hashrate-update
```

## Rental Flow

1. **Rental Created**
   - Platform spins up proxy instance for this rental
   - Proxy listens on unique port (e.g., 33001)
   - Proxy forwards to renter's pool

2. **Rig Connects**
   - Owner points rig to: `platform.com:33001`
   - Username: rental-specific token
   - Password: x

3. **Mining Starts**
   - Proxy tracks shares
   - Calculates hashrate every minute
   - POSTs to API

4. **Rental Ends**
   - Proxy shuts down
   - Historical data in hashrate_logs

## API Integration

Add internal endpoint for proxy to report:

```python
# app/api/v1/internal.py
@router.post("/internal/hashrate-update")
async def hashrate_update(
    rental_id: int,
    hashrate: float,
    api_key: str,  # Internal API key for proxy
    db: AsyncSession = Depends(get_db),
):
    # Verify internal API key
    if api_key != settings.INTERNAL_API_KEY:
        raise HTTPException(status_code=401)

    # Log hashrate
    from app.services.hashrate import log_hashrate
    rental = await db.get(Rental, rental_id)

    await log_hashrate(
        db=db,
        rental_id=rental_id,
        measured_hashrate=hashrate,
        advertised_hashrate=float(rental.hashrate),
        source="stratum_proxy"
    )

    return {"status": "ok"}
```

## Production Deployment

1. **Dynamic Proxy Instances**
   - Each rental gets unique proxy
   - Kubernetes pods or Docker containers
   - Auto-scale based on active rentals

2. **Monitoring**
   - Track proxy health
   - Alert if proxy crashes
   - Automatic restart

3. **Security**
   - Rental-specific authentication tokens
   - Rate limiting
   - DDoS protection
