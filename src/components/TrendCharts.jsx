import { Box, Grid, HStack, Text, VStack } from '@chakra-ui/react';
import { WINDOWS } from './WindowToggle';
import { computeSpend, workerRevenue, inWindow } from '../lib/rateMath';

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

function buildArea(values, w, h, pad = 4) {
  if (values.length < 2) return '';
  const max = Math.max(...values, 0.0001);
  const step = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${pts[0]} L${pts.slice(1).join(' L')} L${(pad + (values.length - 1) * step).toFixed(1)},${(h - pad).toFixed(1)} L${pad},${(h - pad).toFixed(1)} Z`;
}
function buildLine(values, w, h, pad = 4) {
  if (values.length < 2) return '';
  const max = Math.max(...values, 0.0001);
  const step = (w - pad * 2) / (values.length - 1);
  return values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function Donut({ slices }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = 42, circ = 2 * Math.PI * r;
  const segments = slices.reduce((acc, s) => {
    const len = (s.value / total) * circ;
    acc.items.push({ color: s.color, len, offset: acc.runningOffset });
    acc.runningOffset += len;
    return acc;
  }, { items: [], runningOffset: 0 }).items;
  return (
    <svg viewBox="0 0 110 110" width="96" height="96">
      <circle cx="55" cy="55" r={r} fill="none" stroke="var(--line-faint)" strokeWidth="8" />
      {segments.map((seg, i) => (
        <circle key={i} cx="55" cy="55" r={r} fill="none" stroke={seg.color} strokeWidth="8"
                strokeDasharray={`${seg.len} ${circ}`} strokeDashoffset={-seg.offset}
                transform="rotate(-90 55 55)"
                style={{ transition: 'stroke-dasharray 400ms var(--ease)' }} />
      ))}
    </svg>
  );
}

// eslint-disable-next-line no-unused-vars
export default function TrendCharts({ bufferRef, bufferVersion, window: windowId, computeMetrics }) {
  const w = WINDOWS.find(x => x.id === windowId) || WINDOWS[0];
  const windowMs = isFinite(w.ms) ? w.ms : 30 * 24 * 60 * 60 * 1000;
  const allTxs = bufferRef.items();
  const windowTxs = inWindow(allTxs, windowMs);

  const isAll = windowId === 'all';
  const dailySeries = isAll ? (computeMetrics?.daily || []) : [];

  let spendBuckets, revBuckets, spend, rev, com;
  if (isAll && dailySeries.length > 0) {
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
    com = Math.max(0, spend - rev);
  }

  const subsidy = Math.max(0, rev - spend);

  return (
    <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={3} className="fade-in">
      <Panel title="TON flow" subtitle={`compute spend vs worker payouts · ${w.label}`}>
        <svg viewBox="0 0 400 120" width="100%" height="120" preserveAspectRatio="none" style={{ display: 'block', marginTop: '12px' }}>
          <defs>
            <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="4" y1="116" x2="396" y2="116" stroke="var(--line-faint)" strokeWidth="0.5" />
          <path d={buildArea(spendBuckets, 400, 120)} fill="url(#gSpend)" />
          <path d={buildLine(spendBuckets, 400, 120)} fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinejoin="round" />
          <path d={buildArea(revBuckets, 400, 120)} fill="url(#gRev)" />
          <path d={buildLine(revBuckets, 400, 120)} fill="none" stroke="var(--info)" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>

        <HStack spacing={5} mt={3} fontSize="11px" fontFamily="var(--ff-mono)" color="var(--fg-dim)" flexWrap="wrap">
          <Legend dot="var(--accent)" label="spend" value={`${spend.toFixed(2)} TON`} />
          <Legend dot="var(--info)" label="payouts" value={`${rev.toFixed(2)} TON`} />
        </HStack>
      </Panel>

      <Panel title="Split" subtitle={`where TON settles · ${w.label}`}>
        <HStack spacing={4} mt={2} align="center">
          <Donut slices={[
            { color: 'var(--info)', value: rev },
            { color: 'var(--warn)', value: Math.max(com, subsidy) },
          ]} />
          <VStack align="stretch" spacing={2} fontFamily="var(--ff-mono)" fontSize="12px" flex={1}>
            <HStack justify="space-between">
              <Legend dot="var(--info)" label="workers" />
              <Text color="var(--fg)" fontWeight="500">
                {rev + Math.max(com, subsidy) > 0 ? Math.round((rev / (rev + Math.max(com, subsidy))) * 100) : 0}%
              </Text>
            </HStack>
            <HStack justify="space-between">
              <Legend dot="var(--warn)" label={subsidy > com ? 'subsidy' : 'commission'} />
              <Text color="var(--fg)" fontWeight="500">
                {rev + Math.max(com, subsidy) > 0 ? Math.round((Math.max(com, subsidy) / (rev + Math.max(com, subsidy))) * 100) : 0}%
              </Text>
            </HStack>
          </VStack>
        </HStack>
      </Panel>
    </Grid>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <Box bg="var(--bg-elev-1)" border="1px solid var(--line-faint)" borderRadius="var(--radius)" p={4}>
      <Text fontSize="13px" fontWeight="600" color="var(--fg)" letterSpacing="-0.005em">
        {title}
      </Text>
      <Text fontSize="11px" color="var(--fg-dim)" mt={0.5}>
        {subtitle}
      </Text>
      {children}
    </Box>
  );
}

function Legend({ dot, label, value }) {
  return (
    <HStack spacing={1.5}>
      <Box w="8px" h="8px" borderRadius="2px" bg={dot} />
      <Text color="var(--fg-dim)">{label}</Text>
      {value && <Text color="var(--fg)">· {value}</Text>}
    </HStack>
  );
}
