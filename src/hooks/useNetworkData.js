import { useState, useEffect, useCallback } from 'react';
import { fetchDiscovery } from '../api/backend';
import { DISCOVERY_INTERVAL_MS } from '../constants';

function toMaps(raw) {
  const data = {
    root: raw.root,
    proxies: new Map(),
    clients: new Map(),
    workers: new Map(),
    cocoonWallets: new Map(),
    allTransactions: raw.transactions || [],
  };

  for (const p of raw.proxies || []) {
    data.proxies.set(p.address, {
      ...p,
      clients: new Map((p.clients || []).map(a => [a, { address: a }])),
      workers: new Map((p.workers || []).map(a => [a, { address: a }])),
    });
  }
  for (const c of raw.clients || []) data.clients.set(c.address, c);
  for (const w of raw.workers || []) data.workers.set(w.address, w);
  for (const cw of raw.cocoonWallets || []) data.cocoonWallets.set(cw.address, cw);

  return data;
}

function computeStats(data) {
  let totalBalance = parseInt(data.root.balance || '0');
  for (const p of data.proxies.values()) totalBalance += parseInt(p.balance || '0');
  for (const cw of data.cocoonWallets.values()) totalBalance += parseInt(cw.balance || '0');

  let totalTonFlow = 0, totalFees = 0;
  const dailyVolume = {};

  for (const tx of data.allTransactions) {
    const inVal = parseInt(tx.in_msg?.value || '0');
    const fee = parseInt(tx.fee || '0');
    totalTonFlow += inVal;
    totalFees += fee;
    const day = new Date(tx.utime * 1000).toISOString().slice(0, 10);
    if (!dailyVolume[day]) dailyVolume[day] = { date: day, volume: 0, txCount: 0, fees: 0, revenue: 0, tokensEstimated: 0 };
    dailyVolume[day].volume += inVal / 1e9;
    dailyVolume[day].txCount += 1;
    dailyVolume[day].fees += fee / 1e9;

    // Track revenue (payments to workers/proxies) and estimate tokens
    if (tx.contractRole === 'proxy' || tx.contractRole === 'cocoon_wallet') {
      for (const m of tx.out_msgs || []) {
        const outVal = parseInt(m.value || '0');
        if (outVal > 0) {
          dailyVolume[day].revenue += outVal / 1e9;
          // Estimate tokens: ~60 nanoTON per token average (3x multiplier mix)
          dailyVolume[day].tokensEstimated += outVal / 60;
        }
      }
    }
    // Client top-ups = input spending
    if (tx.contractRole === 'cocoon_wallet' || tx.contractRole === 'client') {
      if (inVal > 0) {
        dailyVolume[day].revenue += inVal / 1e9;
        dailyVolume[day].tokensEstimated += inVal / 60;
      }
    }
  }

  let workerPayments = 0, proxyFees = 0;
  for (const tx of data.allTransactions) {
    if (tx.contractRole === 'proxy' || tx.contractRole === 'cocoon_wallet') {
      for (const m of tx.out_msgs || []) {
        const val = parseInt(m.value || '0');
        if (data.workers.has(m.destination)) workerPayments += val;
        else if (!data.proxies.has(m.destination) && !data.cocoonWallets.has(m.destination)
                 && m.destination !== data.root.address) proxyFees += val;
      }
    }
  }

  return {
    totalBalance: totalBalance / 1e9,
    proxyCount: data.proxies.size,
    clientCount: data.clients.size,
    workerCount: data.workers.size,
    cocoonWalletCount: data.cocoonWallets.size,
    totalTonFlow: totalTonFlow / 1e9,
    totalFees: totalFees / 1e9,
    volumeData: Object.values(dailyVolume).sort((a, b) => a.date.localeCompare(b.date)),
    spendBreakdown: [
      { name: 'Worker Payments', value: workerPayments / 1e9 },
      { name: 'Proxy Fees', value: proxyFees / 1e9 },
      { name: 'Network Fees', value: totalFees / 1e9 },
      { name: 'Other', value: Math.max(0, (totalTonFlow - workerPayments - proxyFees) / 1e9) },
    ].filter(s => s.value > 0),
  };
}

export function useNetworkData() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isLive, setIsLive] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setIsLive(true);
      const raw = await fetchDiscovery();
      const mapped = toMaps(raw);
      setData(mapped);
      setStats(computeStats(mapped));
      setLastRefresh(new Date());
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Discovery failed:', err);
      setError(err.message);
      setIsLive(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const interval = setInterval(refresh, DISCOVERY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { data, stats, loading, error, lastRefresh, isLive, refresh };
}
