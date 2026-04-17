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

function buildArea(values, w, h, pad = 6) {
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

function buildLine(values, w, h, pad = 6) {
  if (values.length < 2) return '';
  const max = Math.max(...values, 1);
  const step = (w - pad * 2) / (values.length - 1);
  return values
    .map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function Donut({ slices }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = 44, circ = 2 * Math.PI * r;
  const segments = slices.reduce((acc, s) => {
    const len = (s.value / total) * circ;
    acc.items.push({ color: s.color, len, offset: acc.runningOffset });
    acc.runningOffset += len;
    return acc;
  }, { items: [], runningOffset: 0 }).items;
  return (
    <svg viewBox="0 0 120 120" width="110" height="110">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="10" />
      {segments.map((seg, i) => (
        <circle key={i} cx="60" cy="60" r={r} fill="none" stroke={seg.color} strokeWidth="10"
                strokeDasharray={`${seg.len} ${circ}`} strokeDashoffset={-seg.offset}
                strokeLinecap="butt"
                transform="rotate(-90 60 60)"
                style={{ transition: 'stroke-dasharray 400ms var(--ease-soft)' }} />
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
    <Box className="fade-up-3">
      <HStack spacing={4} align="baseline" flexWrap="wrap" mb={4}>
        <Text
          fontSize="11px"
          fontFamily="var(--ff-mono)"
          letterSpacing="0.24em"
          textTransform="uppercase"
          color="var(--ink-low)"
        >
          § III · Flow
        </Text>
        <Text
          fontFamily="var(--ff-display)"
          fontStyle="italic"
          fontSize="16px"
          color="var(--ink-mid)"
          sx={{ fontVariationSettings: '"opsz" 18, "SOFT" 80' }}
        >
          where the TON moves over the selected window
        </Text>
      </HStack>

      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={0}
            borderTop="1px solid var(--line-faint)"
            borderBottom="1px solid var(--line-faint)"
            sx={{
              '& > div': { borderRight: { base: 'none', lg: '1px solid var(--line-faint)' } },
              '& > div:last-child': { borderRight: 'none', borderTop: { base: '1px solid var(--line-faint)', lg: 'none' } },
            }}
      >
        {/* Flow area chart */}
        <Box p={{ base: 5, md: 6 }}>
          <HStack justify="space-between" align="baseline" mb={4} flexWrap="wrap">
            <Box>
              <Text fontFamily="var(--ff-display)" fontSize="22px" color="var(--ink-high)" fontWeight="400"
                sx={{ fontVariationSettings: '"opsz" 32, "SOFT" 30', letterSpacing: '-0.01em' }}>
                TON flow
              </Text>
              <Text fontFamily="var(--ff-display)" fontStyle="italic" fontSize="13px" color="var(--ink-mid)"
                sx={{ fontVariationSettings: '"opsz" 14, "SOFT" 80' }}>
                compute spend vs. worker payouts · {w.label}
              </Text>
            </Box>
          </HStack>

          <svg viewBox="0 0 400 140" width="100%" height="140" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
            <defs>
              <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e8c674" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#e8c674" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#82d5a7" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#82d5a7" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* grid baseline */}
            <line x1="6" y1="134" x2="394" y2="134" stroke="var(--line-faint)" strokeWidth="0.5" />
            <path d={buildArea(spendBuckets, 400, 140)} fill="url(#gSpend)" />
            <path d={buildLine(spendBuckets, 400, 140)} fill="none" stroke="var(--honey)" strokeWidth="1.3" strokeLinejoin="round" />
            <path d={buildArea(revBuckets, 400, 140)} fill="url(#gRev)" />
            <path d={buildLine(revBuckets, 400, 140)} fill="none" stroke="var(--mint)" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>

          <HStack spacing={6} mt={4} fontSize="11px" fontFamily="var(--ff-mono)" color="var(--ink-mid)" flexWrap="wrap">
            <HStack spacing={2}>
              <Box w="10px" h="1.5px" bg="var(--honey)" />
              <Text>Compute spend · <Box as="span" color="var(--ink-high)">{spend.toFixed(2)} TON</Box></Text>
            </HStack>
            <HStack spacing={2}>
              <Box w="10px" h="1.5px" bg="var(--mint)" />
              <Text>Worker payouts · <Box as="span" color="var(--ink-high)">{rev.toFixed(2)} TON</Box></Text>
            </HStack>
          </HStack>
        </Box>

        {/* Donut */}
        <Box p={{ base: 5, md: 6 }}>
          <Box>
            <Text fontFamily="var(--ff-display)" fontSize="22px" color="var(--ink-high)" fontWeight="400"
              sx={{ fontVariationSettings: '"opsz" 32, "SOFT" 30', letterSpacing: '-0.01em' }}>
              Split
            </Text>
            <Text fontFamily="var(--ff-display)" fontStyle="italic" fontSize="13px" color="var(--ink-mid)"
              sx={{ fontVariationSettings: '"opsz" 14, "SOFT" 80' }} mb={4}>
              where the TON settles · {w.label}
            </Text>
          </Box>

          <HStack spacing={5} align="center">
            <Donut slices={[
              { color: 'var(--mint)', value: rev },
              { color: 'var(--honey)', value: Math.max(com, subsidy) },
            ]} />
            <VStack align="stretch" spacing={3} fontFamily="var(--ff-mono)" fontSize="12px" flex={1}>
              <HStack spacing={3}>
                <Box w="8px" h="8px" borderRadius="50%" bg="var(--mint)" />
                <Text color="var(--ink-high)">Workers · {spend > 0 ? Math.round((rev / (rev + Math.max(com, subsidy))) * 100) : 0}%</Text>
              </HStack>
              <HStack spacing={3}>
                <Box w="8px" h="8px" borderRadius="50%" bg="var(--honey)" />
                <Text color="var(--ink-high)">{subsidy > com ? 'Subsidy' : 'Commission'} · {rev + Math.max(com, subsidy) > 0 ? Math.round((Math.max(com, subsidy) / (rev + Math.max(com, subsidy))) * 100) : 0}%</Text>
              </HStack>
            </VStack>
          </HStack>
        </Box>
      </Grid>
    </Box>
  );
}
