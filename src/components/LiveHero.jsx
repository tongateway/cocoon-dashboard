import { Box, Flex, HStack, Text, Grid } from '@chakra-ui/react';
import Sparkline from './Sparkline';
import WindowToggle, { WINDOWS } from './WindowToggle';
import {
  computeSpend, workerRevenue, tokensProcessed, inWindow,
} from '../lib/rateMath';

// ============================================================
// Formatters — Fraunces numerals look best with tabular figures.
// ============================================================
function splitTon(nano) {
  // Returns { whole, unit } for display — big whole number in display serif, unit in body sans.
  const ton = nano / 1e9;
  if (ton >= 1000) return { whole: (ton / 1000).toFixed(1), unit: 'K' };
  if (ton >= 10)   return { whole: ton.toFixed(1), unit: '' };
  if (ton >= 1)    return { whole: ton.toFixed(2), unit: '' };
  if (ton > 0)     return { whole: ton.toFixed(3), unit: '' };
  return { whole: '0', unit: '' };
}
function splitCount(n) {
  if (!n) return { whole: '0', unit: '' };
  if (n >= 1e9) return { whole: (n / 1e9).toFixed(1), unit: 'B' };
  if (n >= 1e6) return { whole: (n / 1e6).toFixed(1), unit: 'M' };
  if (n >= 1e3) return { whole: (n / 1e3).toFixed(0), unit: 'K' };
  return { whole: String(n), unit: '' };
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

  // "Balance" KPI: worker payouts relative to client spend.
  //   > 100%  → network subsidizes workers (workers earn more than clients pay)
  //   < 100%  → network keeps a commission
  //   = 100%  → exact pass-through
  const ratioPct = spend > 0 ? (rev / spend) * 100 : null;
  const balance = computeBalance(ratioPct, spend, rev, spendHourly, revHourly);

  const unit = windowId === 'all' ? 'TON total' : 'TON / hr';
  const unitCount = windowId === 'all' ? 'total' : '/ hr';

  return (
    <Box className="fade-up-1">
      {/* Section head + window toggle */}
      <Flex justify="space-between" align="baseline" wrap="wrap" gap={4} mb={6}
            borderBottom="1px solid var(--line-faint)" pb={4}>
        <HStack spacing={4} align="baseline" flexWrap="wrap">
          <Text
            fontSize="11px"
            fontFamily="var(--ff-mono)"
            letterSpacing="0.24em"
            textTransform="uppercase"
            color="var(--ink-low)"
          >
            § II · Live Indicators
          </Text>
          <Text
            fontFamily="var(--ff-display)"
            fontStyle="italic"
            fontSize="16px"
            color="var(--ink-mid)"
            sx={{ fontVariationSettings: '"opsz" 18, "SOFT" 80' }}
          >
            {isAlive ? 'beating in real time' : 'resting'}
          </Text>
        </HStack>
        <HStack spacing={3}>
          <Text fontSize="11px" fontFamily="var(--ff-mono)" color="var(--ink-faint)"
                letterSpacing="0.18em" textTransform="uppercase">
            last tx · {timeAgo(lastTxUtime)} ago
          </Text>
          <WindowToggle value={windowId} onChange={onWindowChange} />
        </HStack>
      </Flex>

      {/* KPI row — hairline-separated columns, editorial type */}
      <Grid
        templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }}
        gap={0}
        sx={{
          '& > div': {
            borderRight: '1px solid var(--line-faint)',
            borderBottom: '1px solid var(--line-faint)',
          },
          '& > div:last-child': { borderRight: 'none' },
          '@media (min-width: 62em)': {
            '& > div': { borderBottom: 'none' },
          },
          '@media (max-width: 62em)': {
            '& > div:nth-of-type(2), & > div:last-child': { borderRight: 'none' },
          },
          '@media (max-width: 48em)': {
            '& > div': { borderRight: 'none !important' },
            '& > div:last-child': { borderBottom: 'none' },
          },
        }}
      >
        <Kpi
          eyebrow="Compute spend"
          caption="paid by clients"
          value={splitTon(spendHourly)}
          unit={unit}
          tone="var(--honey)"
          spark={sparkSpend}
          sparkColor="var(--honey)"
          delay="0.05s"
        />
        <Kpi
          eyebrow="Worker revenue"
          caption="paid to workers"
          value={splitTon(revHourly)}
          unit={unit}
          tone="var(--mint)"
          spark={sparkRev}
          sparkColor="var(--mint)"
          delay="0.12s"
        />
        <Kpi
          eyebrow={balance.eyebrow}
          caption={balance.caption}
          value={balance.value}
          unit={balance.unit || unit}
          tone={balance.tone}
          spark={sparkSpend.map((v, i) => Math.abs(v - sparkRev[i]))}
          sparkColor={balance.tone}
          delay="0.18s"
        />
        <Kpi
          eyebrow="Tokens processed"
          caption={`~ ${pricePerToken} nanoTON / token`}
          value={splitCount(tokHourly)}
          unit={unitCount}
          tone="var(--plum)"
          spark={sparkSpend}
          sparkColor="var(--plum)"
          delay="0.25s"
        />
      </Grid>
    </Box>
  );
}

function computeBalance(ratioPct, spend, rev, spendHourly, revHourly) {
  if (ratioPct === null) {
    return {
      eyebrow: 'Network take-rate',
      caption: 'waiting for activity',
      value: { whole: '—', unit: '' },
      unit: '',
      tone: 'var(--ink-faint)',
    };
  }
  if (ratioPct > 100) {
    const subsidyHourly = Math.max(0, revHourly - spendHourly);
    return {
      eyebrow: 'Worker subsidy',
      caption: `workers earn ${Math.round(ratioPct)}% of client spend`,
      value: splitTon(subsidyHourly),
      tone: 'var(--plum)',
    };
  }
  const commissionHourly = Math.max(0, spendHourly - revHourly);
  return {
    eyebrow: 'Network commission',
    caption: `${Math.round(100 - ratioPct)}% take · proxies + root`,
    value: splitTon(commissionHourly),
    tone: 'var(--honey)',
  };
}

function Kpi({ eyebrow, caption, value, unit, tone, spark, sparkColor, delay }) {
  return (
    <Box
      p={{ base: 5, md: 6 }}
      position="relative"
      className="fade-up"
      sx={{ animationDelay: delay }}
    >
      {/* Eyebrow */}
      <Text
        fontSize="10px"
        fontFamily="var(--ff-body)"
        letterSpacing="0.22em"
        textTransform="uppercase"
        color="var(--ink-low)"
        fontWeight="500"
        mb={4}
      >
        {eyebrow}
      </Text>

      {/* Big display number */}
      <HStack align="baseline" spacing={2} mb={1}>
        <Text
          fontFamily="var(--ff-display)"
          fontSize={{ base: '48px', md: '58px' }}
          color={tone}
          fontWeight="300"
          sx={{
            fontVariationSettings: '"opsz" 144, "SOFT" 10',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums lining-nums',
          }}
        >
          {value.whole}
        </Text>
        {value.unit && (
          <Text
            fontFamily="var(--ff-display)"
            fontSize={{ base: '28px', md: '34px' }}
            color={tone}
            fontStyle="italic"
            fontWeight="300"
            sx={{ fontVariationSettings: '"opsz" 72, "SOFT" 100' }}
          >
            {value.unit}
          </Text>
        )}
        <Text
          fontSize="12px"
          color="var(--ink-low)"
          fontFamily="var(--ff-body)"
          letterSpacing="-0.005em"
          ml={1}
        >
          {unit}
        </Text>
      </HStack>

      {/* Caption */}
      <Text
        fontFamily="var(--ff-display)"
        fontStyle="italic"
        fontSize="13px"
        color="var(--ink-mid)"
        sx={{ fontVariationSettings: '"opsz" 16, "SOFT" 90' }}
        mb={3}
      >
        {caption}
      </Text>

      {/* Sparkline */}
      <Box opacity={0.85}>
        <Sparkline values={spark} color={sparkColor} height={28} width={100} />
      </Box>
    </Box>
  );
}
