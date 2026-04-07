// Blockchain crawler - scans new blocks for cocoon contract deployments
// Runs as background job in the server

import crypto from 'crypto';

const CODE_TYPES = {
  'cfd7fb56c93c4e68': 'cocoon_root',
  '4693d2a95d0e55d4': 'cocoon_proxy',
  '3204b6ab0ec40172': 'cocoon_client',
  '8641e3b7669e0366': 'cocoon_worker',
  '2051342c307e220a': 'cocoon_wallet',
};

function classifyCode(codeBase64) {
  if (!codeBase64) return null;
  const h = crypto.createHash('sha256').update(Buffer.from(codeBase64, 'base64')).digest('hex').slice(0, 16);
  return CODE_TYPES[h] || null;
}

export class CocoonCrawler {
  constructor(toncenterClient) {
    this.tc = toncenterClient;
    this.knownRoots = new Map(); // address -> { balance, state, config }
    this.lastSeqno = 0;
    this.scanning = false;
    this.scanInterval = null;
  }

  unwrap(r) {
    if (!r.data.ok) throw new Error(r.data.error || 'toncenter error');
    return r.data.result;
  }

  // Start periodic scanning
  start(intervalMs = 30_000) {
    console.log('[crawler] Starting block scanner...');
    this.scan(); // Initial scan
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
      // Get current masterchain info
      const mcInfo = this.unwrap(await this.tc.get('/getMasterchainInfo'));
      const currentSeqno = mcInfo.last.seqno;

      if (this.lastSeqno === 0) {
        // First run: scan last 100 blocks
        this.lastSeqno = Math.max(1, currentSeqno - 100);
        console.log(`[crawler] Initial scan: blocks ${this.lastSeqno} to ${currentSeqno}`);
      }

      if (currentSeqno <= this.lastSeqno) {
        this.scanning = false;
        return;
      }

      // Scan new blocks (limit to 20 per cycle to avoid overloading)
      const startSeqno = this.lastSeqno + 1;
      const endSeqno = Math.min(currentSeqno, startSeqno + 20);

      for (let seqno = startSeqno; seqno <= endSeqno; seqno++) {
        try {
          await this.scanBlock(seqno);
        } catch (e) {
          // Block might not exist or be accessible
        }
      }

      this.lastSeqno = endSeqno;
    } catch (e) {
      console.warn('[crawler] Scan error:', e.message);
    }

    this.scanning = false;
  }

  async scanBlock(seqno) {
    // Get shards for this masterchain block
    const shards = this.unwrap(await this.tc.get('/getShards', { params: { seqno } }));

    // Check masterchain block transactions
    await this.scanBlockTxs(-1, '-9223372036854775808', seqno);

    // Check each shard block
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
        const addr = txRef.account;
        if (!addr) continue;

        // Check if this is a new cocoon contract
        // Only check addresses we haven't seen
        const friendlyAddr = `${workchain}:${addr}`;
        if (this.knownRoots.has(friendlyAddr)) continue;

        // We can't easily check code hash from block transactions
        // Instead, check the account if it received a deploy (state_init)
        // For efficiency, only check accounts in workchain 0 (basechain)
      }
    } catch {
      // Some blocks might not be accessible
    }
  }

  // Direct method: check a specific address if it's a cocoon root
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
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Scan deployer wallet for root contract deployments
  async scanDeployer(deployerAddress) {
    console.log(`[crawler] Scanning deployer ${deployerAddress.slice(0, 25)}...`);
    let lt, hash;
    let found = 0;

    for (let page = 0; page < 10; page++) {
      const params = { address: deployerAddress, limit: 50 };
      if (lt) { params.lt = lt; params.hash = hash; }

      const txs = this.unwrap(await this.tc.get('/getTransactions', { params }));
      if (txs.length === 0) break;

      // Check all destination addresses
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

    console.log(`[crawler] Deployer scan complete: ${found} new root(s) found`);
    return found;
  }
}
