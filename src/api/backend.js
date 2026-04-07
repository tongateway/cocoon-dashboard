import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'https://cocoon-dashboard-api.jarvis-agent.workers.dev';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
});

export async function fetchDiscovery() {
  const res = await client.get('/api/discover');
  return res.data;
}

export async function fetchAddressInfo(address) {
  const res = await client.get(`/api/address/${address}`);
  return res.data;
}

export async function fetchTransactions(address, limit = 30) {
  const res = await client.get(`/api/transactions/${address}`, { params: { limit } });
  return res.data;
}

export async function fetchAccountType(address) {
  const res = await client.get(`/api/account-type/${address}`);
  return res.data;
}

export async function fetchAnalysis(address) {
  const res = await client.get(`/api/analysis/${address}`, { timeout: 60_000 });
  return res.data;
}
