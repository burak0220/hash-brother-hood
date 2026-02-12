import { BrowserProvider, Contract, parseUnits } from 'ethers';

const BSC_CHAIN_ID = '0x38'; // 56 in hex
const BSC_CHAIN_CONFIG = {
  chainId: BSC_CHAIN_ID,
  chainName: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: ['https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com/'],
};

const USDT_CONTRACT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const USDT_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

function getEthereum(): any {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    return (window as any).ethereum;
  }
  return null;
}

export function isMetaMaskInstalled(): boolean {
  return !!getEthereum();
}

export async function connectWallet(): Promise<string> {
  const ethereum = getEthereum();
  if (!ethereum) {
    throw new Error('MetaMask is not installed');
  }

  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts found');
  }

  await switchToBSC();

  return accounts[0];
}

export async function switchToBSC(): Promise<void> {
  const ethereum = getEthereum();
  if (!ethereum) throw new Error('MetaMask is not installed');

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BSC_CHAIN_ID }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [BSC_CHAIN_CONFIG],
      });
    } else {
      throw switchError;
    }
  }
}

export async function getConnectedAccount(): Promise<string | null> {
  const ethereum = getEthereum();
  if (!ethereum) return null;

  const accounts = await ethereum.request({ method: 'eth_accounts' });
  return accounts && accounts.length > 0 ? accounts[0] : null;
}

export async function transferUSDT(to: string, amount: string): Promise<string> {
  const ethereum = getEthereum();
  if (!ethereum) throw new Error('MetaMask is not installed');

  await switchToBSC();

  const provider = new BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const contract = new Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, signer);

  const amountWei = parseUnits(amount, 18);
  const tx = await contract.transfer(to, amountWei);
  const receipt = await tx.wait();

  return receipt.hash;
}
