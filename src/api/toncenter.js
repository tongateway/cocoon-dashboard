import axios from 'axios';
import { TONCENTER_BASE_URL, TONCENTER_API_KEY } from '../constants';

const client = axios.create({
  baseURL: TONCENTER_BASE_URL,
  headers: { 'X-API-Key': TONCENTER_API_KEY },
  timeout: 10_000,
});

function unwrap(response) {
  const data = response.data;
  if (!data.ok) throw new Error(data.error || 'Toncenter API error');
  return data.result;
}

export async function getAddressInfo(address) {
  const res = await client.get('/getAddressInformation', { params: { address } });
  return unwrap(res);
}

export async function getBalance(address) {
  const res = await client.get('/getAddressBalance', { params: { address } });
  return unwrap(res);
}

export async function getTransactions(address, limit = 50) {
  const res = await client.get('/getTransactions', { params: { address, limit } });
  return unwrap(res);
}

export async function getWalletInfo(address) {
  const res = await client.get('/getWalletInformation', { params: { address } });
  return unwrap(res);
}

export async function runGetMethod(address, method, stack = []) {
  const res = await client.post('/runGetMethod', { address, method, stack });
  return unwrap(res);
}
