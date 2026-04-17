import axios from 'axios';

const client = axios.create({
  baseURL: 'https://tonapi.io/v2',
  timeout: 15_000,
});

// Simple sequential queue to avoid 429s
let lastRequest = 0;
const MIN_DELAY = 200; // ms between requests

async function throttledGet(url) {
  const now = Date.now();
  const wait = Math.max(0, MIN_DELAY - (now - lastRequest));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequest = Date.now();
  return client.get(url);
}

export async function getAccountInfo(address) {
  const res = await throttledGet(`/accounts/${address}`);
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

const TONAPI_BASE = 'https://tonapi.io/v2';
const TONAPI_TOKEN = import.meta.env.VITE_TONAPI_TOKEN || '';

export function sseUrl(accounts) {
  const csv = encodeURIComponent(accounts.join(','));
  return `${TONAPI_BASE}/sse/accounts/transactions?accounts=${csv}`;
}

export function sseHeaders() {
  return TONAPI_TOKEN ? { Authorization: `Bearer ${TONAPI_TOKEN}` } : {};
}

export async function fetchTransactionByHash(hash) {
  const res = await client.get(`/blockchain/transactions/${hash}`);
  return res.data;
}
