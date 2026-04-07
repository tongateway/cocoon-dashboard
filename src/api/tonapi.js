import axios from 'axios';

const client = axios.create({
  baseURL: 'https://tonapi.io/v2',
  timeout: 15_000,
});

export async function getAccountInfo(address) {
  const res = await client.get(`/accounts/${address}`);
  return res.data;
}

export async function getAccountTransactions(address, limit = 30) {
  const res = await client.get(`/blockchain/accounts/${address}/transactions`, {
    params: { limit },
  });
  return res.data.transactions || [];
}

// Classify contract by its interfaces from tonapi
export function classifyCocoonContract(accountInfo) {
  const interfaces = accountInfo.interfaces || [];
  const isWallet = accountInfo.is_wallet || false;

  for (const iface of interfaces) {
    if (iface === 'cocoon_root') return 'root';
    if (iface === 'cocoon_proxy') return 'proxy';
    if (iface === 'cocoon_client') return 'client';
    if (iface === 'cocoon_worker') return 'worker';
    if (iface === 'cocoon_wallet') return 'cocoon_wallet';
  }

  if (isWallet) return 'wallet';

  // Check for jetton wallets
  if (interfaces.some(i => i.startsWith('jetton_wallet'))) return 'jetton';

  return 'unknown';
}
