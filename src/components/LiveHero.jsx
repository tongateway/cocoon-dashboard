import { Box, Flex, HStack, Text, Grid } from '@chakra-ui/react';
import Sparkline from './Sparkline';
import WindowToggle, { WINDOWS } from './WindowToggle';
import {
  computeSpend, workerRevenue, tokensProcessed, inWindow,
} from '../lib/rateMath';

function fmtTon(nano) {
  const ton = nano / 1e9;
  if (ton >= 1000) return `${(ton / 1000).toFixed(1)}K`;
  if (ton >= 10)   return ton.toFixed(1);
  if (ton >= 1)    return ton.toFixed(2);
  if (ton > 0)     return ton.toFixed(3);
  return '0';
}
function fmtCount(n) {
  if (!n) return '0';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}
function timeAgo(utime) {
  if (!utime) return '—';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - utime));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}
function asHourlyRate(total, windowMs) {
  if (!isFinite(windowMs) || windowMs === 0) return total;
  return total / (windowMs / (60 * 60 * 1000));
}
function bucketSparkline(txs, valueFn, bucketMs = 60 * 60 * 1000, buckets = 24) {
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
  isAlive, lastTxUtime, bufferRef, bufferVersion, pricePerToken = 20, // eslint-disable-line no-unused-vars
  window: windowId, onWindowChange, computeMetricsTotals,
}) {
  const w = WINDOWS.find(x => x.id === windowId) || WINDOWS[0];
  const allTxs = bufferRef.items();
  const windowTxs = isFinite(w.ms) ? inWindow(allTxs, w.ms) : allTxs;
  const last24h = inWindow(allTxs, 24 * 60 * 60 * 1000);

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
  const balance = computeBalance(ratioPct, spendHourly, revHourly);

  const unit = windowId === 'all' ? 'TON' : 'TON/h';
  const unitCount = windowId === 'all' ? '' : '/h';

  return (
    <Box className="fade-in">
      <Flex justify="space-between" align="center" mb={3} wrap="wrap" gap={3}>
        <HStack spacing={3} align="center">
          <Text fontSize="13px" fontWeight="600" color="var(--fg)">
            Indicators
          </Text>
          <Text fontSize="12px" color="var(--fg-dim)" fontFamily="var(--ff-mono)">
            last tx · {timeAgo(lastTxUtime)} ago {isAlive ? '· live' : ''}
          </Text>
        </HStack>
        <WindowToggle value={windowId} onChange={onWindowChange} />
      </Flex>

      <Grid
        templateColumns={{ base: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }}
        gap={3}
      >
        <Kpi
          label="Compute spend"
          caption="paid by clients"
          value={fmtTon(spendHourly)}
          unit={unit}
          tone="var(--fg)"
          spark={sparkSpend}
          sparkColor="var(--accent)"
        />
        <Kpi
          label="Worker revenue"
          caption="paid to workers"
          value={fmtTon(revHourly)}
          unit={unit}
          tone="var(--fg)"
          spark={sparkRev}
          sparkColor="var(--info)"
        />
        <Kpi
          label={balance.label}
          caption={balance.caption}
          value={balance.value}
          unit={balance.unit || unit}
          tone={balance.tone}
          spark={sparkSpend.map((v, i) => Math.abs(v - sparkRev[i]))}
          sparkColor={balance.tone}
        />
        <Kpi
          label="Tokens processed"
          caption={`${pricePerToken} nanoTON / token`}
          value={fmtCount(tokHourly)}
          unit={unitCount}
          tone="var(--fg)"
          spark={sparkSpend}
          sparkColor="var(--violet)"
        />
      </Grid>
    </Box>
  );
}

function computeBalance(ratioPct, spendHourly, revHourly) {
  if (ratioPct === null) {
    return { label: 'Network balance', caption: 'no activity yet', value: '—', unit: '', tone: 'var(--fg-dim)' };
  }
  if (ratioPct > 100) {
    return {
      label: 'Worker subsidy',
      caption: `workers earn ${Math.round(ratioPct)}% of spend`,
      value: fmtTon(Math.max(0, revHourly - spendHourly)),
      tone: 'var(--violet)',
    };
  }
  return {
    label: 'Network commission',
    caption: `${Math.round(100 - ratioPct)}% take rate`,
    value: fmtTon(Math.max(0, spendHourly - revHourly)),
    tone: 'var(--warn)',
  };
}

function Kpi({ label, caption, value, unit, tone, spark, sparkColor }) {
  return (
    <Box
      bg="var(--bg-elev-1)"
      border="1px solid var(--line-faint)"
      borderRadius="var(--radius)"
      p={4}
      _hover={{ borderColor: 'var(--line)' }}
      sx={{ transition: 'border-color 150ms var(--ease)' }}
    >
      <Text
        fontSize="11px"
        color="var(--fg-dim)"
        fontWeight="500"
        letterSpacing="-0.005em"
        mb={2}
      >
        {label}
      </Text>

      <HStack align="baseline" spacing={1.5} mb={1}>
        <Text
          fontSize="24px"
          fontWeight="500"
          color={tone}
          letterSpacing="-0.025em"
          lineHeight="1"
          sx={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </Text>
        {unit && (
          <Text fontSize="11px" color="var(--fg-faint)" fontFamily="var(--ff-mono)">
            {unit}
          </Text>
        )}
      </HStack>

      <Text fontSize="11px" color="var(--fg-faint)" mb={3}>
        {caption}
      </Text>

      <Box opacity={0.85}>
        <Sparkline values={spark} color={sparkColor} height={24} width={100} />
      </Box>
    </Box>
  );
}
