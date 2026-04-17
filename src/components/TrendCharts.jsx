import { Box, Grid, HStack, Text } from '@chakra-ui/react';
import { WINDOWS } from './WindowToggle';
import { computeSpend, workerRevenue, commission, inWindow } from '../lib/rateMath';

function bucket(txs, windowMs, bucketCount, valueFn) {
  const now = Date.now();
  const step = windowMs / bucketCount;
  const out = new Array(bucketCount).fill(0);
  for (const tx of txs) {
    const age = now - (tx.utime || 0) * 1000;
    if (age < 0 || age >= windowMs) continue;
    const idx = bucketCount - 1 - Math.floor(age / step);
    if (idx >= 0 && idx < bucketCount) out[idx] += valueFn(tx);
  }
  return out;
}

function buildArea(values, w, h, pad = 2) {
  if (values.length < 2) return '';
  const max = Math.max(...values, 1);
  const step = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${pts[0]} L${pts.slice(1).join(' L')} L${(pad + (values.length - 1) * step).toFixed(1)},${(h - pad).toFixed(1)} L${pad},${(h - pad).toFixed(1)} Z`;
}

function Donut({ slices }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = 38, circ = 2 * Math.PI * r;
  const segments = slices.reduce((acc, s) => {
    const len = (s.value / total) * circ;
    acc.items.push({ color: s.color, len, offset: acc.runningOffset });
    acc.runningOffset += len;
    return acc;
  }, { items: [], runningOffset: 0 }).items;
  return (
    <svg viewBox="0 0 100 100" width="100" height="100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#30363d" strokeWidth="12" />
      {segments.map((seg, i) => (
        <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={seg.color} strokeWidth="12"
                strokeDasharray={`${seg.len} ${circ}`} strokeDashoffset={-seg.offset}
                transform="rotate(-90 50 50)" />
      ))}
    </svg>
  );
}

// eslint-disable-next-line no-unused-vars
export default function TrendCharts({ bufferRef, bufferVersion, window: windowId, computeMetrics }) {
  const w = WINDOWS.find(x => x.id === windowId) || WINDOWS[0];
  const windowMs = isFinite(w.ms) ? w.ms : 30 * 24 * 60 * 60 * 1000; // "all" renders last 30d
  const allTxs = bufferRef.items();
  const windowTxs = inWindow(allTxs, windowMs);

  const isAll = windowId === 'all';
  const dailySeries = isAll ? (computeMetrics?.daily || []) : [];

  let spendBuckets, revBuckets, spend, rev, com;
  if (isAll && dailySeries.length > 0) {
    // Use pre-computed daily aggregates (covers full tracked history, not limited by buffer)
    spendBuckets = dailySeries.map(d => d.computeSpendTon || 0);
    revBuckets = dailySeries.map(d => d.workerRevenueTon || 0);
    spend = computeMetrics.totals?.computeSpendTon || 0;
    rev = computeMetrics.totals?.workerRevenueTon || 0;
    com = Math.max(0, spend - rev);
  } else {
    const buckets = windowId === '1h' ? 30 : windowId === '24h' ? 24 : windowId === '7d' ? 24 * 7 : 30;
    spendBuckets = bucket(windowTxs, windowMs, buckets, tx =>
      (tx.contractRole === 'cocoon_proxy' && tx._op === 'client_proxy_request') ||
      (tx.contractRole === 'cocoon_client' && tx._op === 'ext_client_charge_signed')
        ? parseInt(tx.in_msg?.value || '0', 10) / 1e9 : 0);
    revBuckets = bucket(windowTxs, windowMs, buckets, tx =>
      tx.contractRole === 'cocoon_worker' && tx._op === 'ext_worker_payout_signed'
        ? parseInt(tx.in_msg?.value || '0', 10) / 1e9 : 0);
    spend = computeSpend(windowTxs) / 1e9;
    rev = workerRevenue(windowTxs) / 1e9;
    com = commission(windowTxs) / 1e9;
  }

  return (
    <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={3}>
      <Box bg="#161b22" border="1px solid #30363d" borderRadius="10px" p={4}>
        <Text fontSize="13px" fontWeight="600" color="#e6edf3">
          TON flow · compute spend vs worker payouts
        </Text>
        <Text fontSize="11px" color="#8b949e" mt={1} mb={2}>
          Selected window: {w.label} · stacked areas
        </Text>
        <svg viewBox="0 0 400 120" width="100%" height="120" preserveAspectRatio="none">
          <defs>
            <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3fb950" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#3fb950" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#58a6ff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#58a6ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={buildArea(spendBuckets, 400, 120)} fill="url(#gSpend)" stroke="#3fb950" strokeWidth="1.5" />
          <path d={buildArea(revBuckets, 400, 120)} fill="url(#gRev)" stroke="#58a6ff" strokeWidth="1.5" />
        </svg>
        <HStack spacing={4} mt={2}>
          <Text fontSize="11px" color="#8b949e">
            <Box as="span" display="inline-block" w="9px" h="9px" bg="#3fb950" borderRadius="2px" mr={1} />
            Compute spend · {spend.toFixed(2)} TON
          </Text>
          <Text fontSize="11px" color="#8b949e">
            <Box as="span" display="inline-block" w="9px" h="9px" bg="#58a6ff" borderRadius="2px" mr={1} />
            Worker payouts · {rev.toFixed(2)} TON
          </Text>
        </HStack>
      </Box>

      <Box bg="#161b22" border="1px solid #30363d" borderRadius="10px" p={4}>
        <Text fontSize="13px" fontWeight="600" color="#e6edf3">Where the TON goes</Text>
        <Text fontSize="11px" color="#8b949e" mt={1}>commission split · {w.label}</Text>
        <HStack spacing={4} mt={2} align="center">
          <Donut slices={[
            { color: '#3fb950', value: rev },
            { color: '#d29922', value: com },
          ]} />
          <Box fontSize="12px" color="#e6edf3">
            <HStack><Box w="9px" h="9px" bg="#3fb950" borderRadius="50%" /><Text>Workers · {spend > 0 ? Math.round((rev / spend) * 100) : 0}%</Text></HStack>
            <HStack><Box w="9px" h="9px" bg="#d29922" borderRadius="50%" /><Text>Commission · {spend > 0 ? Math.round((com / spend) * 100) : 0}%</Text></HStack>
          </Box>
        </HStack>
      </Box>
    </Grid>
  );
}
