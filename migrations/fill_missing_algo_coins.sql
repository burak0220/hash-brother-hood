-- Fill coins + difficulty data for algorithms that were missing them
-- Run once against the live database: psql ... -f fill_missing_algo_coins.sql

UPDATE algorithms SET coins = 'Garlicoin',                             diff_suggested = 256,      diff_min = 32,       diff_max = 16384      WHERE name = 'allium';
UPDATE algorithms SET coins = 'Dero',                                   diff_suggested = 500000,   diff_min = 50000,    diff_max = 10000000   WHERE name = 'astrobwt';
UPDATE algorithms SET coins = 'Chaincoin, Futo',                        diff_suggested = 512,      diff_min = 64,       diff_max = 65536      WHERE name = 'c11';
UPDATE algorithms SET coins = 'Decred',                                  diff_suggested = 65536,    diff_min = 1024,     diff_max = 4194304    WHERE name = 'decred';
UPDATE algorithms SET coins = 'Dynex',                                   diff_suggested = 100000,   diff_min = 10000,    diff_max = 2000000    WHERE name = 'dynex';
UPDATE algorithms SET coins = 'Nervos Network (CKB)',                    diff_suggested = 512,      diff_min = 64,       diff_max = 65536      WHERE name = 'eaglesong';
UPDATE algorithms SET coins = 'Various Ethash coins',                    diff_suggested = 4000000,  diff_min = 500000,   diff_max = 8388608    WHERE name = 'ethash-b3';
UPDATE algorithms SET coins = 'Raptoreum',                               diff_suggested = 65536,    diff_min = 1024,     diff_max = 4194304    WHERE name = 'ghostrider';
UPDATE algorithms SET coins = 'Groestlcoin',                             diff_suggested = 512,      diff_min = 64,       diff_max = 65536      WHERE name = 'groestl';
UPDATE algorithms SET coins = 'Espers',                                  diff_suggested = 256,      diff_min = 32,       diff_max = 16384      WHERE name = 'hmq1725';
UPDATE algorithms SET coins = 'Handshake',                               diff_suggested = 8,        diff_min = 1,        diff_max = 1024       WHERE name = 'handshake';
UPDATE algorithms SET coins = 'Kadena',                                  diff_suggested = 65536,    diff_min = 1024,     diff_max = 4194304    WHERE name = 'kadena';
UPDATE algorithms SET coins = 'LBRY Credits',                            diff_suggested = 65536,    diff_min = 1024,     diff_max = 4194304    WHERE name = 'lbry';
UPDATE algorithms SET coins = 'Firo (FIRO)',                             diff_suggested = 512,      diff_min = 64,       diff_max = 65536      WHERE name = 'mtp';
UPDATE algorithms SET coins = 'Myriad, DigiByte',                        diff_suggested = 512,      diff_min = 64,       diff_max = 65536      WHERE name = 'myr-gr';
UPDATE algorithms SET coins = 'Various NIST5 coins',                     diff_suggested = 256,      diff_min = 32,       diff_max = 16384      WHERE name = 'nist5';
UPDATE algorithms SET coins = 'Feathercoin, Orbitcoin, PhoenixCoin',     diff_suggested = 512,      diff_min = 64,       diff_max = 65536      WHERE name = 'neoscrypt';
UPDATE algorithms SET coins = 'Nexa',                                    diff_suggested = 65536,    diff_min = 1024,     diff_max = 4194304    WHERE name = 'nexapow';
UPDATE algorithms SET coins = 'Conflux Network',                         diff_suggested = 4000000,  diff_min = 500000,   diff_max = 8388608    WHERE name = 'octopus';
UPDATE algorithms SET coins = 'DigiByte',                                diff_suggested = 512,      diff_min = 64,       diff_max = 65536      WHERE name = 'odocrypt';
UPDATE algorithms SET coins = 'LuxCoin',                                 diff_suggested = 256,      diff_min = 32,       diff_max = 16384      WHERE name = 'phi2';
UPDATE algorithms SET coins = 'QuarkCoin',                               diff_suggested = 256,      diff_min = 32,       diff_max = 16384      WHERE name = 'quark';
UPDATE algorithms SET coins = 'DigiByte',                                diff_suggested = 512,      diff_min = 64,       diff_max = 65536      WHERE name = 'qubit';
UPDATE algorithms SET coins = 'Radiant',                                 diff_suggested = 65536,    diff_min = 1024,     diff_max = 4194304    WHERE name = 'radiant';
UPDATE algorithms SET coins = 'Siacoin',                                 diff_suggested = 512,      diff_min = 64,       diff_max = 65536      WHERE name = 'sia';
UPDATE algorithms SET coins = 'DigiByte, Myriad',                        diff_suggested = 512,      diff_min = 64,       diff_max = 65536      WHERE name = 'skein';
UPDATE algorithms SET coins = 'Signatum',                                diff_suggested = 256,      diff_min = 32,       diff_max = 16384      WHERE name = 'skunk';
UPDATE algorithms SET coins = 'MachineCoin, Bitcore',                    diff_suggested = 512,      diff_min = 64,       diff_max = 65536      WHERE name = 'timetravel';
UPDATE algorithms SET coins = 'Denarius',                                diff_suggested = 256,      diff_min = 32,       diff_max = 16384      WHERE name = 'tribus';
UPDATE algorithms SET coins = 'Verus Coin',                              diff_suggested = 512,      diff_min = 64,       diff_max = 65536      WHERE name = 'verushash';
UPDATE algorithms SET coins = 'Xelis',                                   diff_suggested = 65536,    diff_min = 1024,     diff_max = 4194304    WHERE name = 'xelishash';
UPDATE algorithms SET coins = 'BitSend, XVG (Verge)',                    diff_suggested = 256,      diff_min = 32,       diff_max = 16384      WHERE name = 'xevan';
UPDATE algorithms SET coins = 'ZK-proof based coins',                    diff_suggested = 512,      diff_min = 64,       diff_max = 65536      WHERE name = 'zksnark';
