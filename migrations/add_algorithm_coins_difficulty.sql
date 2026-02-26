-- Add coins info and difficulty defaults to algorithms table
ALTER TABLE algorithms
  ADD COLUMN IF NOT EXISTS coins VARCHAR(500),
  ADD COLUMN IF NOT EXISTS diff_suggested BIGINT,
  ADD COLUMN IF NOT EXISTS diff_min BIGINT,
  ADD COLUMN IF NOT EXISTS diff_max BIGINT;

-- Seed coins + difficulty defaults for major algorithms
-- SHA-256 Family
UPDATE algorithms SET coins = 'Bitcoin, Bitcoin Cash, eCash, Bitcoin SV',
  diff_suggested = 65536, diff_min = 1024, diff_max = 4194304
  WHERE name = 'sha256';
UPDATE algorithms SET coins = 'Bitcoin (AsicBoost)',
  diff_suggested = 65536, diff_min = 1024, diff_max = 4194304
  WHERE name = 'sha256asicboost';
UPDATE algorithms SET coins = 'Bitcoin SV',
  diff_suggested = 65536, diff_min = 1024, diff_max = 4194304
  WHERE name IN ('sha256d', 'sha256dt', 'sha512256d');

-- Scrypt Family
UPDATE algorithms SET coins = 'Litecoin, Dogecoin, Einsteinium',
  diff_suggested = 1024, diff_min = 64, diff_max = 131072
  WHERE name = 'scrypt';
UPDATE algorithms SET coins = 'Vertcoin (old)',
  diff_suggested = 512, diff_min = 64, diff_max = 65536
  WHERE name = 'scryptnf';

-- Ethash / EVM Family
UPDATE algorithms SET coins = 'Ethereum Classic, Callisto',
  diff_suggested = 4000000000, diff_min = 1000000000, diff_max = 16000000000
  WHERE name = 'ethash';
UPDATE algorithms SET coins = 'Ethereum Classic',
  diff_suggested = 4000000000, diff_min = 1000000000, diff_max = 16000000000
  WHERE name = 'etchash';
UPDATE algorithms SET coins = 'Ubiq',
  diff_suggested = 1000000000, diff_min = 500000000, diff_max = 8000000000
  WHERE name = 'ubqhash';

-- Equihash Family
UPDATE algorithms SET coins = 'Zcash, Komodo, Horizen',
  diff_suggested = 512, diff_min = 64, diff_max = 16384
  WHERE name = 'equihash';
UPDATE algorithms SET coins = 'BTCZ, BitcoinZ',
  diff_suggested = 256, diff_min = 32, diff_max = 8192
  WHERE name = 'equihash1254';
UPDATE algorithms SET coins = 'Zcash (144_5), BitcoinGold',
  diff_suggested = 512, diff_min = 64, diff_max = 16384
  WHERE name = 'equihash1445';
UPDATE algorithms SET coins = 'Flux, ZelCash',
  diff_suggested = 64, diff_min = 8, diff_max = 2048
  WHERE name IN ('equihash1505', 'zelhash');
UPDATE algorithms SET coins = 'Komodo',
  diff_suggested = 256, diff_min = 32, diff_max = 8192
  WHERE name = 'equihash1927';
UPDATE algorithms SET coins = 'Ycash',
  diff_suggested = 128, diff_min = 16, diff_max = 4096
  WHERE name = 'equihash2109';
UPDATE algorithms SET coins = 'BitcoinGold, Anon',
  diff_suggested = 512, diff_min = 64, diff_max = 16384
  WHERE name = 'zhash';
UPDATE algorithms SET coins = 'Beam',
  diff_suggested = 8, diff_min = 1, diff_max = 256
  WHERE name = 'beamhashiii';

-- Blake Family
UPDATE algorithms SET coins = 'Decred',
  diff_suggested = 262144, diff_min = 32768, diff_max = 8388608
  WHERE name = 'blake256r14';
UPDATE algorithms SET coins = 'Siacoin',
  diff_suggested = 2000000000000, diff_min = 500000000000, diff_max = 50000000000000
  WHERE name IN ('blake2b', 'blake2bsia');
UPDATE algorithms SET coins = 'Kadena',
  diff_suggested = 1000000000, diff_min = 100000000, diff_max = 100000000000
  WHERE name IN ('blake2s', 'blake2skadena');
UPDATE algorithms SET coins = 'Alephium',
  diff_suggested = 100000000, diff_min = 10000000, diff_max = 10000000000
  WHERE name IN ('blake3', 'blake3dcr');

-- KawPoW / ProgPoW Family
UPDATE algorithms SET coins = 'Ravencoin',
  diff_suggested = 1000000, diff_min = 100000, diff_max = 100000000
  WHERE name = 'kawpow';
UPDATE algorithms SET coins = 'Firo',
  diff_suggested = 500000, diff_min = 50000, diff_max = 50000000
  WHERE name = 'firopow';
UPDATE algorithms SET coins = 'Meowcoin',
  diff_suggested = 500000, diff_min = 50000, diff_max = 50000000
  WHERE name = 'meowpow';
UPDATE algorithms SET coins = 'Sero',
  diff_suggested = 500000, diff_min = 50000, diff_max = 50000000
  WHERE name IN ('progpow', 'progpowz', 'evrprogpow');

-- RandomX Family (CPU)
UPDATE algorithms SET coins = 'Monero',
  diff_suggested = 100000, diff_min = 10000, diff_max = 2000000
  WHERE name = 'randomx';
UPDATE algorithms SET coins = 'Safex Cash',
  diff_suggested = 50000, diff_min = 5000, diff_max = 1000000
  WHERE name = 'randomsfx';
UPDATE algorithms SET coins = 'Wownero',
  diff_suggested = 50000, diff_min = 5000, diff_max = 1000000
  WHERE name = 'randomwow';
UPDATE algorithms SET coins = 'ArQmA',
  diff_suggested = 50000, diff_min = 5000, diff_max = 1000000
  WHERE name = 'randomarq';

-- CryptoNight Family
UPDATE algorithms SET coins = 'Monero (legacy), Electroneum',
  diff_suggested = 50000, diff_min = 5000, diff_max = 1000000
  WHERE name LIKE 'cryptonight%';

-- X-Series
UPDATE algorithms SET coins = 'Dash',
  diff_suggested = 8192, diff_min = 512, diff_max = 524288
  WHERE name = 'x11';
UPDATE algorithms SET coins = 'Sibcoin',
  diff_suggested = 4096, diff_min = 256, diff_max = 262144
  WHERE name = 'x11gost';
UPDATE algorithms SET coins = 'Cryptocoin',
  diff_suggested = 4096, diff_min = 256, diff_max = 262144
  WHERE name = 'x13';
UPDATE algorithms SET coins = 'Ravencoin (legacy)',
  diff_suggested = 1000000, diff_min = 100000, diff_max = 100000000
  WHERE name IN ('x16r', 'x16rv2', 'x16rt', 'x16s', 'x17', 'x21s', 'x25x');

-- Lyra2
UPDATE algorithms SET coins = 'Vertcoin',
  diff_suggested = 8192, diff_min = 512, diff_max = 524288
  WHERE name IN ('lyra2rev2', 'lyra2rev3');
UPDATE algorithms SET coins = 'Zcoin (legacy)',
  diff_suggested = 8192, diff_min = 512, diff_max = 524288
  WHERE name = 'lyra2z';

-- HeavyHash / Kaspa
UPDATE algorithms SET coins = 'Kaspa',
  diff_suggested = 1000000000, diff_min = 100000000, diff_max = 100000000000
  WHERE name IN ('heavyhash', 'kheavyhash', 'karlsenhash');

-- Yescrypt / YesPower (CPU)
UPDATE algorithms SET coins = 'Zcash (CPU), YENTEN',
  diff_suggested = 1000, diff_min = 100, diff_max = 100000
  WHERE name LIKE 'yescrypt%';
UPDATE algorithms SET coins = 'Sugarchain, SUGAR',
  diff_suggested = 1000, diff_min = 100, diff_max = 100000
  WHERE name LIKE 'yespower%';

-- GPU Specific
UPDATE algorithms SET coins = 'Vertcoin',
  diff_suggested = 65536, diff_min = 8192, diff_max = 2097152
  WHERE name = 'verthash';
UPDATE algorithms SET coins = 'Ergo',
  diff_suggested = 500000000, diff_min = 100000000, diff_max = 10000000000
  WHERE name = 'autolykos2';
UPDATE algorithms SET coins = 'IronFish',
  diff_suggested = 1000000000, diff_min = 100000000, diff_max = 100000000000
  WHERE name = 'fishhash';

-- Cuckoo Family
UPDATE algorithms SET coins = 'Grin',
  diff_suggested = 1, diff_min = 1, diff_max = 128
  WHERE name LIKE 'cucka%' OR name LIKE 'cuckoo%';
UPDATE algorithms SET coins = 'Cortex',
  diff_suggested = 1, diff_min = 1, diff_max = 64
  WHERE name = 'cortex';

-- SHA-3 / Keccak
UPDATE algorithms SET coins = 'Maxcoin, Creativecoin',
  diff_suggested = 1024, diff_min = 64, diff_max = 131072
  WHERE name IN ('sha3', 'keccak');

-- Argon2
UPDATE algorithms SET coins = 'Nimiq, Chukwa',
  diff_suggested = 10000, diff_min = 1000, diff_max = 500000
  WHERE name LIKE 'argon2%' OR name = 'chukwa';
