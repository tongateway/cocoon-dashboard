import { Box, Grid, HStack, Text } from '@chakra-ui/react';
import Sparkline from './Sparkline';
import WindowToggle, { WINDOWS } from './WindowToggle';
import NetworkHealth from './NetworkHealth';
import {
  computeSpend, workerRevenue, tokensProcessed, inWindow,
  activeWorkers, activeClients,
} from '../lib/rateMath';

const ACTIVE_MS = 60 * 60 * 1000; // fixed 1h for "active" counts

function fmtTon(nano) {
  const ton = nano / 1e9;
  if (ton >= 1000) return { val: (ton / 1000).toFixed(1), unit: 'K TON' };
  if (ton >= 10)   return { val: ton.toFixed(1), unit: 'TON' };
  if (ton >= 1)    return { val: ton.toFixed(2), unit: 'TON' };
  if (ton > 0)     return { val: ton.toFixed(3), unit: 'TON' };
  return { val: '0', unit: 'TON' };
}
function fmtCount(n) {
  if (!n) return { val: '0', unit: '' };
  if (n >= 1e9) return { val: (n / 1e9).toFixed(1), unit: 'B' };
  if (n >= 1e6) return { val: (n / 1e6).toFixed(1), unit: 'M' };
  if (n >= 1e3) return { val: (n / 1e3).toFixed(0), unit: 'K' };
  return { val: String(n), unit: '' };
}
function asHourlyRate(total, windowMs) {
  if (!isFinite(windowMs) || windowMs === 0) return total;
  return total / (windowMs / (60 * 60 * 1000));
}
function bucketSparkline(txs, valueFn, bucketMs = 60 * 60 * 1000, buckets = 40) {
  const now = Date.now();
  const out = new Array(buckets).fill(0);
  for (const tx of txs) {
    const age = now - (tx.utime || 0) * 1000;
    if (age < 0 || age > bucketMs * buckets) continue;
    const idx = buckets - 1 - Math.floor(age / bucketMs);
    out[idx] += valueFn(tx);
  }
  return out;
}

export default function LiveHero({
  // eslint-disable-next-line no-unused-vars
  isAlive, lastTxUtime, bufferRef, bufferVersion, pricePerToken = 20,
  window: windowId, onWindowChange, computeMetricsTotals, graph,
}) {
  const w = WINDOWS.find(x => x.id === windowId) || WINDOWS[0];
  const allTxs = bufferRef.items();
  const windowTxs = isFinite(w.ms) ? inWindow(allTxs, w.ms) : allTxs;
  const last24h = inWindow(allTxs, 24 * 60 * 60 * 1000);
  const recent = inWindow(allTxs, ACTIVE_MS);

  // Active contracts = active workers + active clients in the last 1h (fixed per spec)
  const activeW = activeWorkers(recent);
  const activeC = activeClients(recent);
  const totalContracts = (graph?.workers?.size || 0) + (graph?.clients?.size || 0) + (graph?.proxies?.size || 0);
  const activeContracts = activeW + activeC;

  const useTotals = windowId === 'all' && computeMetricsTotals;
  const spend = useTotals ? Math.round(computeMetricsTotals.computeSpendTon * 1e9) : computeSpend(windowTxs);
  const rev = useTotals ? Math.round(computeMetricsTotals.workerRevenueTon * 1e9) : workerRevenue(windowTxs);
  const tok = useTotals ? (computeMetricsTotals.tokensMix || 0) : tokensProcessed(windowTxs, pricePerToken);

  const spendHourly = asHourlyRate(spend, w.ms);
  const revHourly = asHourlyRate(rev, w.ms);
  const tokHourly = asHourlyRate(tok, w.ms);

  const sparkSpend = bucketSparkline(last24h, tx =>
    (tx.contractRole === 'cocoon_proxy' && tx._op === 'client_proxy_request') ||
    (tx.contractRole === 'cocoon_client' && tx._op === 'ext_client_charge_signed')
      ? parseInt(tx.in_msg?.value || '0', 10) / 1e9 : 0);
  const sparkRev = bucketSparkline(last24h, tx =>
    tx.contractRole === 'cocoon_worker' && tx._op === 'ext_worker_payout_signed'
      ? parseInt(tx.in_msg?.value || '0', 10) / 1e9 : 0);

  const ratioPct = spend > 0 ? (rev / spend) * 100 : null;
  const balance = computeBalance(ratioPct);

  const windowSuffix = windowId === 'all' ? '' : ' / hr';
  const spendFmt = fmtTon(spendHourly);
  const revFmt = fmtTon(revHourly);
  const tokFmt = fmtCount(tokHourly);

  return (
    <Box id="overview" className="fade-in">
      {/* Page head */}
      <HStack justify="space-between" align="flex-end" mb="24px" flexWrap="wrap" gap={3}>
        <Box>
          <Text fontSize="20px" fontWeight="600" letterSpacing="-0.015em" color="var(--fg-0)" mb="4px">
            Network overview
          </Text>
          <Text fontSize="12.5px" color="var(--fg-2)">
            Real-time health and performance across the Cocoon agent network.
          </Text>
        </Box>
        <HStack spacing="8px">
          <WindowToggle value={windowId} onChange={onWindowChange} />
        </HStack>
      </HStack>

      <NetworkHealth bufferRef={bufferRef} bufferVersion={bufferVersion} />

      {/* KPI strip — connected grid with 1px gutters */}
      <Grid
        mt="16px"
        templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }}
        gap="1px"
        sx={{
          background: 'var(--line-soft)',
          border: '1px solid var(--line-soft)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <Kpi
          label="Active contracts"
          value={{ val: String(activeContracts), unit: `/ ${totalContracts}` }}
          delta={null}
          deltaLabel={`earning or spending · last hour`}
          spark={sparkRev}
          sparkColor="var(--accent)"
        />
        <Kpi
          label="Compute spend"
          value={spendFmt}
          unit={spendFmt.unit + windowSuffix}
          delta={null}
          deltaLabel="paid by clients"
          spark={sparkSpend}
          sparkColor="var(--accent)"
        />
        <Kpi
          label="Worker revenue"
          value={revFmt}
          unit={revFmt.unit + windowSuffix}
          delta={null}
          deltaLabel="paid to workers"
          spark={sparkRev}
          sparkColor="var(--info)"
        />
        <Kpi
          label="Tokens processed"
          value={tokFmt}
          unit={tokFmt.unit + windowSuffix}
          delta={null}
          deltaLabel={balance.label + ' · ' + balance.caption}
          spark={sparkSpend}
          sparkColor="var(--accent)"
        />
      </Grid>
    </Box>
  );
}

function computeBalance(ratioPct) {
  if (ratioPct === null) {
    return { label: 'Take-rate', caption: 'no activity yet' };
  }
  if (ratioPct > 100) {
    return {
      label: 'Subsidy',
      caption: `workers earn ${Math.round(ratioPct)}% of spend`,
    };
  }
  return {
    label: 'Commission',
    caption: `${Math.round(100 - ratioPct)}% network take`,
  };
}

function Kpi({ label, value, unit, delta, deltaLabel, spark, sparkColor }) {
  return (
    <Box
      sx={{
        background: 'var(--bg-1)',
        padding: '16px 18px 14px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '108px',
        position: 'relative',
      }}
    >
      <Text
        sx={{
          fontSize: '11.5px',
          color: 'var(--fg-2)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 500,
        }}
      >
        {label}
      </Text>

      <HStack
        align="baseline"
        spacing="6px"
        mt="8px"
        sx={{
          fontFamily: 'var(--ff-mono)',
          fontSize: '26px',
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: 'var(--fg-0)',
        }}
      >
        <Text as="span">{value.val}</Text>
        {(value.unit || unit) && (
          <Text as="span" fontSize="13px" color="var(--fg-2)" fontWeight="400">
            {value.unit || unit}
          </Text>
        )}
      </HStack>

      <HStack mt="auto" spacing="6px" fontSize="11.5px" color="var(--fg-2)">
        {delta != null && (
          <Text
            className="mono"
            color={delta > 0 ? 'var(--ok)' : 'var(--err)'}
            fontWeight="500"
          >
            {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
          </Text>
        )}
        <Text>{deltaLabel}</Text>
      </HStack>

      {/* Sparkline in top-right corner, as per design */}
      <Box sx={{ position: 'absolute', right: '14px', top: '14px', width: '80px', height: '28px' }}>
        <Sparkline values={spark} color={sparkColor} height={28} width={80} />
      </Box>
    </Box>
  );
}
