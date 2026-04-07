// Blockchain crawler - scans new blocks for cocoon contract deployments
// Persists state to disk so it doesn't rescan on restart

import crypto from 'crypto';
import { load, save } from './store.js';

const CODE_TYPES = {
  // Root
  'cfd7fb56c93c4e68': 'cocoon_root',
  // Proxy versions
  '4693d2a95d0e55d4': 'cocoon_proxy',
  '5598b6810bed2266': 'cocoon_proxy',
  // Client versions
  '3204b6ab0ec40172': 'cocoon_client',
  '81b712e7d26313be': 'cocoon_client',
  '32f26bd974265be9': 'cocoon_client',
  // Worker
  '8641e3b7669e0366': 'cocoon_worker',
  // Wallet versions
  '2051342c307e220a': 'cocoon_wallet',
  '9bd714dcc1ff9058': 'cocoon_wallet',
  '51d730a6efdfe50c': 'cocoon_wallet',
};

function classifyCode(codeBase64) {
  if (!codeBase64) return null;
  const h = crypto.createHash('sha256').update(Buffer.from(codeBase64, 'base64')).digest('hex').slice(0, 16);
  return CODE_TYPES[h] || null;
}

export class CocoonCrawler {
  constructor(toncenterClient) {
    this.tc = toncenterClient;
    this.scanning = false;
    this.scanInterval = null;

    // Load persisted state
    const state = load('crawler_state', { knownRoots: {}, lastSeqno: 0, deployersScanned: [] });
    this.knownRoots = new Map(Object.entries(state.knownRoots));
    this.lastSeqno = state.lastSeqno;
    this.deployersScanned = new Set(state.deployersScanned);

    if (this.knownRoots.size > 0) {
      console.log(`[crawler] Loaded ${this.knownRoots.size} known roots, lastSeqno=${this.lastSeqno}`);
    }
  }

  persist() {
    save('crawler_state', {
      knownRoots: Object.fromEntries(this.knownRoots),
      lastSeqno: this.lastSeqno,
      deployersScanned: [...this.deployersScanned],
    });
  }

  unwrap(r) {
    if (!r.data.ok) throw new Error(r.data.error || 'toncenter error');
    return r.data.result;
  }

  start(intervalMs = 30_000) {
    console.log('[crawler] Starting block scanner...');
    this.scan();
    this.scanInterval = setInterval(() => this.scan(), intervalMs);
  }

  stop() {
    if (this.scanInterval) clearInterval(this.scanInterval);
  }

  getKnownRoots() {
    return [...this.knownRoots.entries()].map(([addr, data]) => ({ address: addr, ...data }));
  }

  async scan() {
    if (this.scanning) return;
    this.scanning = true;

    try {
      const mcInfo = this.unwrap(await this.tc.get('/getMasterchainInfo'));
      const currentSeqno = mcInfo.last.seqno;

      if (this.lastSeqno === 0) {
        this.lastSeqno = Math.max(1, currentSeqno - 100);
        console.log(`[crawler] Initial scan: blocks ${this.lastSeqno} to ${currentSeqno}`);
      }

      if (currentSeqno <= this.lastSeqno) {
        this.scanning = false;
        return;
      }

      const startSeqno = this.lastSeqno + 1;
      const endSeqno = Math.min(currentSeqno, startSeqno + 20);

      for (let seqno = startSeqno; seqno <= endSeqno; seqno++) {
        try { await this.scanBlock(seqno); } catch {}
      }

      this.lastSeqno = endSeqno;
      this.persist();
    } catch (e) {
      console.warn('[crawler] Scan error:', e.message);
    }

    this.scanning = false;
  }

  async scanBlock(seqno) {
    const shards = this.unwrap(await this.tc.get('/getShards', { params: { seqno } }));
    await this.scanBlockTxs(-1, '-9223372036854775808', seqno);
    for (const shard of shards.shards || []) {
      await this.scanBlockTxs(shard.workchain, shard.shard, shard.seqno);
    }
  }

  async scanBlockTxs(workchain, shard, seqno) {
    try {
      const blockTxs = this.unwrap(await this.tc.get('/getBlockTransactions', {
        params: { workchain, shard, seqno, count: 40 },
      }));
      for (const txRef of blockTxs.transactions || []) {
        if (!txRef.account) continue;
        const friendlyAddr = `${workchain}:${txRef.account}`;
        if (this.knownRoots.has(friendlyAddr)) continue;
      }
    } catch {}
  }

  async checkAddress(address) {
    try {
      const info = this.unwrap(await this.tc.get('/getAddressInformation', { params: { address } }));
      const type = classifyCode(info.code);
      if (type === 'cocoon_root') {
        this.knownRoots.set(address, {
          balance: info.balance,
          state: info.state,
          type: 'cocoon_root',
          discoveredAt: Date.now(),
        });
        console.log(`[crawler] Found root contract: ${address}`);
        this.persist();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async scanDeployer(deployerAddress) {
    if (this.deployersScanned.has(deployerAddress)) {
      console.log(`[crawler] Deployer ${deployerAddress.slice(0, 25)}... already scanned, skipping`);
      return 0;
    }

    console.log(`[crawler] Scanning deployer ${deployerAddress.slice(0, 25)}...`);
    let lt, hash;
    let found = 0;

    for (let page = 0; page < 10; page++) {
      const params = { address: deployerAddress, limit: 50 };
      if (lt) { params.lt = lt; params.hash = hash; }
      const txs = this.unwrap(await this.tc.get('/getTransactions', { params }));
      if (txs.length === 0) break;

      const dests = new Set();
      for (const tx of txs) {
        for (const m of tx.out_msgs || []) {
          if (m.destination) dests.add(m.destination);
        }
      }

      for (const dest of dests) {
        if (this.knownRoots.has(dest)) continue;
        if (await this.checkAddress(dest)) found++;
      }

      if (txs.length < 50) break;
      const last = txs[txs.length - 1];
      lt = last.transaction_id.lt;
      hash = last.transaction_id.hash;
    }

    this.deployersScanned.add(deployerAddress);
    this.persist();
    console.log(`[crawler] Deployer scan complete: ${found} new root(s) found`);
    return found;
  }
}
