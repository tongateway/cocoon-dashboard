// Toncenter API client for Cloudflare Worker

export class ToncenterClient {
  constructor(apiKey) {
    this.baseUrl = 'https://toncenter.com/api/v2';
    this.apiKey = apiKey;
  }

  async request(endpoint, params = {}) {
    const url = new URL(this.baseUrl + endpoint);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString(), {
      headers: { 'X-API-Key': this.apiKey },
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Toncenter error');
    return data.result;
  }

  getAddressInfo(address) {
    return this.request('/getAddressInformation', { address });
  }

  getTransactions(address, limit = 50) {
    return this.request('/getTransactions', { address, limit });
  }

  async getAllTxs(address, maxPages = 3) {
    let all = [], lt, hash;
    for (let i = 0; i < maxPages; i++) {
      const params = { address, limit: 50 };
      if (lt) { params.lt = lt; params.hash = hash; }
      const txs = await this.request('/getTransactions', params);
      all.push(...txs);
      if (txs.length < 50) break;
      const last = txs[txs.length - 1];
      lt = last.transaction_id.lt;
      hash = last.transaction_id.hash;
    }
    return all;
  }

  getMasterchainInfo() {
    return this.request('/getMasterchainInfo');
  }
}
