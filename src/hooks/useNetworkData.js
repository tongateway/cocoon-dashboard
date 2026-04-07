import { useState, useEffect, useCallback, useRef } from 'react';
import { discoverContracts, aggregateStats } from '../lib/transactionAnalyzer';
import { getTransactions } from '../api/toncenter';
import { ROOT_CONTRACT, POLL_INTERVAL_MS, DISCOVERY_INTERVAL_MS } from '../constants';

export function useNetworkData() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const discoveredRef = useRef(null);

  const fullDiscovery = useCallback(async () => {
    try {
      setIsLive(true);
      const discovered = await discoverContracts(ROOT_CONTRACT);
      discoveredRef.current = discovered;
      setData(discovered);
      setStats(aggregateStats(discovered));
      setLastRefresh(new Date());
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Discovery failed:', err);
      setError(err.message);
      setIsLive(false);
    }
  }, []);

  const quickRefresh = useCallback(async () => {
    if (!discoveredRef.current) return;
    try {
      setIsLive(true);
      const rootTxs = await getTransactions(ROOT_CONTRACT, 20);
      const discovered = discoveredRef.current;

      const txMap = new Map();
      for (const tx of discovered.allTransactions) {
        const key = tx.transaction_id.lt + tx.transaction_id.hash;
        txMap.set(key, tx);
      }
      for (const tx of rootTxs) {
        const key = tx.transaction_id.lt + tx.transaction_id.hash;
        if (!txMap.has(key)) {
          txMap.set(key, { ...tx, contractRole: 'root' });
        }
      }
      discovered.allTransactions = [...txMap.values()].sort((a, b) => b.utime - a.utime);

      setData({ ...discovered });
      setStats(aggregateStats(discovered));
      setLastRefresh(new Date());
    } catch (err) {
      console.warn('Quick refresh failed:', err.message);
    }
  }, []);

  useEffect(() => {
    fullDiscovery();
  }, [fullDiscovery]);

  useEffect(() => {
    const interval = setInterval(quickRefresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [quickRefresh]);

  useEffect(() => {
    const interval = setInterval(fullDiscovery, DISCOVERY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fullDiscovery]);

  return { data, stats, loading, error, lastRefresh, isLive, refresh: fullDiscovery };
}
