import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { fetchDiscovery } from '../api/backend';
import { useLiveFeed } from './useLiveFeed';
import { parseTxOpcode } from '../lib/opcodes';
import { DISCOVERY_INTERVAL_MS } from '../constants';

const ACTIVE_WINDOW_MS = 60 * 60 * 1000; // 1h — fixed per spec

function buildGraph(raw) {
  const graph = {
    root: raw.root,
    proxies: new Map(),
    clients: new Map(),
    workers: new Map(),
    cocoonWallets: new Map(),
    seedTxs: raw.transactions || [],
    computeMetrics: raw.computeMetrics || null,
    pricePerToken: raw.root?.config?.pricePerToken || 20,
  };
  for (const p of raw.proxies || []) graph.proxies.set(p.address, {
    ...p,
    clients: new Map((p.clients || []).map(a => [a, { address: a }])),
    workers: new Map((p.workers || []).map(a => [a, { address: a }])),
  });
  for (const c of raw.clients || []) graph.clients.set(c.address, c);
  for (const w of raw.workers || []) graph.workers.set(w.address, w);
  for (const cw of raw.cocoonWallets || []) graph.cocoonWallets.set(cw.address, cw);
  return graph;
}

function tagRole(graph, tx) {
  const addr = tx.address?.account_address;
  if (!addr) return tx;
  if (graph.proxies.has(addr)) tx.contractRole = 'cocoon_proxy';
  else if (graph.clients.has(addr)) tx.contractRole = 'cocoon_client';
  else if (graph.workers.has(addr)) tx.contractRole = 'cocoon_worker';
  else if (graph.cocoonWallets.has(addr)) tx.contractRole = 'cocoon_wallet';
  else if (addr === graph.root?.address) tx.contractRole = 'root';
  return tx;
}

export function useNetworkData() {
  const [graph, setGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [fallbackPoll, setFallbackPoll] = useState(false);
  const seedRef = useRef([]);

  const refresh = useCallback(async () => {
    try {
      const raw = await fetchDiscovery();
      const g = buildGraph(raw);
      setGraph(g);
      seedRef.current = g.seedTxs.map(tx => {
        tagRole(g, tx);
        if (!tx._op) {
          const op = parseTxOpcode(tx);
          if (op) tx._op = op.name;
        }
        return tx;
      });
      setLastRefresh(new Date());
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error('Discovery failed:', err);
      setError(err.message);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const interval = setInterval(refresh, DISCOVERY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // Subscribe SSE to every Cocoon-owned contract: root + proxies + clients +
  // workers + cocoonWallets. Previously only root+proxies streamed live, so
  // worker payouts and client charges only appeared via the 2-min discovery
  // refresh. Total expected: ~110 accounts which is well within tonapi's limit.
  const accounts = useMemo(() => {
    if (!graph) return [];
    return [
      graph.root?.address,
      ...graph.proxies.keys(),
      ...graph.clients.keys(),
      ...graph.workers.keys(),
      ...graph.cocoonWallets.keys(),
    ].filter(Boolean);
  }, [graph]);

  const { buffer, version, connected } = useLiveFeed({
    accounts,
    seed: seedRef.current,
    onFallback: useCallback(() => setFallbackPoll(true), []),
  });

  // Fallback polling when SSE is down
  useEffect(() => {
    if (!fallbackPoll) return;
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [fallbackPoll, refresh]);

  // Tag role on streamed txs that lack it (tonapi stream doesn't know role)
  // buffer is a stable reference from useLiveFeed's useState initializer — not listed as a dep by design
  useEffect(() => {
    if (!graph) return;
    for (const tx of buffer.items()) {
      if (!tx.contractRole) tagRole(graph, tx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, graph]);

  useEffect(() => {
    if (connected) setFallbackPoll(false);
  }, [connected]);

  const lastTxUtime = useMemo(() => {
    const items = buffer.items();
    return items[0]?.utime || 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // 5-second tick so isAlive re-evaluates against wall-clock time, not only on new txs
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  // tick is included to signal React that isAlive depends on wall-clock time (not just lastTxUtime)
  const nowSec = Date.now() / 1000;
  const isAlive = lastTxUtime > 0 && (nowSec - lastTxUtime) < 300 && tick >= 0;

  return {
    graph,
    buffer,
    bufferVersion: version,
    activeWindowMs: ACTIVE_WINDOW_MS,
    isAlive,
    lastTxUtime,
    connected,
    fallbackPoll,
    loading,
    error,
    lastRefresh,
    refresh,
  };
}
