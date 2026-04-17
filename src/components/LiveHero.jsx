import { Box, Flex, HStack, Text, Grid } from '@chakra-ui/react';
import Sparkline from './Sparkline';
import WindowToggle, { WINDOWS } from './WindowToggle';
import {
  computeSpend, workerRevenue, commission, tokensProcessed, inWindow,
} from '../lib/rateMath';

function fmtTon(nano) {
  const ton = nano / 1e9;
  if (ton >= 1000) return `${(ton / 1000).toFixed(1)}K`;
  if (ton >= 10) return ton.toFixed(1);
  if (ton >= 1) return ton.toFixed(2);
  return ton.toFixed(3);
}
function fmtCount(n) {
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

// Convert window "per-hour rate": divide window total by (windowMs / 3600_000)
function asHourlyRate(total, windowMs) {
  if (!isFinite(windowMs) || windowMs === 0) return total;
  return total / (windowMs / (60 * 60 * 1000));
}

// 24 sparkline buckets, each is one hour
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
  window: windowId, onWindowChange,
}) {
  const w = WINDOWS.find(x => x.id === windowId) || WINDOWS[0];
  const allTxs = bufferRef.items();
  const windowTxs = isFinite(w.ms) ? inWindow(allTxs, w.ms) : allTxs;
  const last24h = inWindow(allTxs, 24 * 60 * 60 * 1000);

  const spend = computeSpend(windowTxs);
  const rev = workerRevenue(windowTxs);
  const com = commission(windowTxs);
  const tok = tokensProcessed(windowTxs, pricePerToken);

  const spendHourly = asHourlyRate(spend, w.ms);
  const revHourly = asHourlyRate(rev, w.ms);
  const comHourly = asHourlyRate(com, w.ms);
  const tokHourly = asHourlyRate(tok, w.ms);

  const sparkSpend = bucketSparkline(last24h, tx =>
    (tx.contractRole === 'cocoon_proxy' && tx._op === 'client_proxy_request') ||
    (tx.contractRole === 'cocoon_client' && tx._op === 'ext_client_charge_signed')
      ? parseInt(tx.in_msg?.value || '0', 10) / 1e9 : 0);
  const sparkRev = bucketSparkline(last24h, tx =>
    tx.contractRole === 'cocoon_worker' && tx._op === 'ext_worker_payout_signed'
      ? parseInt(tx.in_msg?.value || '0', 10) / 1e9 : 0);

  return (
    <Box>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={3} mb={4}>
        <Box>
          <HStack spacing={2} mb={2}>
            <Box as="span" w="8px" h="8px" borderRadius="full" bg={isAlive ? '#3fb950' : '#8b949e'}
                 boxShadow={isAlive ? '0 0 0 0 rgba(63,185,80,0.6)' : 'none'}
                 sx={{ animation: isAlive ? 'pulse 1.4s infinite' : 'none',
                       '@keyframes pulse': {
                          '0%': { boxShadow: '0 0 0 0 rgba(63,185,80,0.6)' },
                          '70%': { boxShadow: '0 0 0 10px rgba(63,185,80,0)' },
                          '100%': { boxShadow: '0 0 0 0 rgba(63,185,80,0)' }
                       } }} />
            <Text fontSize="xs" fontWeight="600" letterSpacing="wide" color={isAlive ? '#3fb950' : '#8b949e'}>
              {isAlive ? 'LIVE' : 'IDLE'}
            </Text>
          </HStack>
          <Text fontSize="28px" fontWeight="700" color="#f0f6fc" lineHeight="1">Cocoon Network</Text>
          <Text fontSize="xs" color="#58a6ff" fontFamily="mono" mt={2}>
            last tx <b>{timeAgo(lastTxUtime)} ago</b>
          </Text>
        </Box>
        <Box>
          <Text fontSize="10px" textTransform="uppercase" color="#7d8590" letterSpacing="0.08em" mb={1}>
            Time window
          </Text>
          <WindowToggle value={windowId} onChange={onWindowChange} />
        </Box>
      </Flex>

      <Grid templateColumns={{ base: '1fr 1fr', lg: 'repeat(4, 1fr)' }} gap={3}>
        <KpiCell
          label="Compute spend" valueMain={fmtTon(spendHourly)} unit={windowId === 'all' ? 'TON total' : 'TON/hr'}
          sub="paid by clients" accent values={sparkSpend} color="#3fb950"
        />
        <KpiCell
          label="Worker revenue" valueMain={fmtTon(revHourly)} unit={windowId === 'all' ? 'TON total' : 'TON/hr'}
          sub={spend > 0 ? `${Math.round((rev / spend) * 100)}% of spend` : 'paid to workers'}
          values={sparkRev} color="#58a6ff"
        />
        <KpiCell
          label="Network commission" valueMain={fmtTon(comHourly)} unit={windowId === 'all' ? 'TON total' : 'TON/hr'}
          sub={spend > 0 ? `${Math.round((com / spend) * 100)}% take · proxies+root` : 'proxies + root'}
          values={sparkSpend.map((v, i) => v - sparkRev[i])} color="#d29922"
        />
        <KpiCell
          label="Tokens processed" valueMain={fmtCount(tokHourly)} unit={windowId === 'all' ? ' total' : '/hr'}
          sub="~ price_per_token: 20 nanoTON" values={sparkSpend} color="#a371f7"
        />
      </Grid>
    </Box>
  );
}

function KpiCell({ label, valueMain, unit, sub, values, color, accent }) {
  return (
    <Box bg="#161b22" border="1px solid #30363d" borderRadius="10px" p={3}
         position="relative" overflow="hidden">
      {accent && <Box position="absolute" top={0} left={0} w="3px" h="100%" bg="#3fb950" />}
      <Text fontSize="10px" textTransform="uppercase" color="#7d8590" letterSpacing="0.08em">{label}</Text>
      <Text fontSize="22px" fontWeight="600" color="#f0f6fc" mt={1}>
        {valueMain} <Text as="span" fontSize="12px" color="#7d8590" fontWeight="400">{unit}</Text>
      </Text>
      <Text fontSize="11px" color="#8b949e" mt={1}>{sub}</Text>
      <Box mt={2}><Sparkline values={values} color={color} height={24} width={100} /></Box>
    </Box>
  );
}
