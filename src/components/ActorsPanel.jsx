import { Box, Grid, Text, HStack, VStack } from '@chakra-ui/react';
import { activeWorkers, activeClients, inWindow } from '../lib/rateMath';
import { classifyTx } from '../lib/txClassify';

const ACTIVE_MS = 60 * 60 * 1000;

const TX_TONES = {
  worker_payout: { label: 'PAYOUT', color: 'var(--info)'   },
  client_charge: { label: 'CHARGE', color: 'var(--accent)' },
  top_up:        { label: 'TOP-UP', color: 'var(--warn)'   },
  proxy_fee:     { label: 'FEE',    color: 'var(--fg-dim)' },
  other:         { label: '—',      color: 'var(--fg-faint)' },
};

function short(addr) {
  if (!addr) return '—';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}
function ago(utime) {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - utime));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}
function fmtVal(nano) {
  const ton = parseInt(nano || '0', 10) / 1e9;
  return ton.toFixed(ton >= 1 ? 2 : 4);
}

// eslint-disable-next-line no-unused-vars
export default function ActorsPanel({ graph, bufferRef, bufferVersion }) {
  if (!graph) return null;
  const all = bufferRef.items();
  const recent = inWindow(all, ACTIVE_MS);

  const totalWorkers = graph.workers.size;
  const totalClients = graph.clients.size;
  const activeW = activeWorkers(recent);
  const activeC = activeClients(recent);

  const feed = all
    .map(tx => ({ ...tx, _type: classifyTx(tx) }))
    .filter(tx => tx._type !== 'other')
    .slice(0, 12);

  return (
    <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr 1.4fr' }} gap={3} className="fade-in">
      <ActorCard n={activeW} total={totalWorkers} label="Workers earning (1h)" tone="var(--info)"
                 detail={`${Math.max(0, totalWorkers - activeW)} idle`} />
      <ActorCard n={activeC} total={totalClients} label="Clients spending (1h)" tone="var(--accent)"
                 detail={`${Math.max(0, totalClients - activeC)} idle`} />

      <Box bg="var(--bg-elev-1)" border="1px solid var(--line-faint)" borderRadius="var(--radius)" p={4}>
        <HStack justify="space-between" mb={3}>
          <Text fontSize="13px" fontWeight="600" color="var(--fg)">Event feed</Text>
          <HStack spacing={1.5}>
            <Box w="6px" h="6px" borderRadius="50%" bg="var(--accent)"
                 sx={{ animation: 'pulse-dot 2s infinite' }} />
            <Text fontSize="10px" color="var(--fg-dim)" fontFamily="var(--ff-mono)">live</Text>
          </HStack>
        </HStack>

        {feed.length === 0 ? (
          <Text fontSize="12px" color="var(--fg-dim)">awaiting transactions…</Text>
        ) : (
          <VStack spacing={0} align="stretch" maxH="220px" overflowY="auto">
            {feed.map(tx => {
              const tone = TX_TONES[tx._type] || TX_TONES.other;
              return (
                <HStack
                  key={tx.id}
                  justify="space-between"
                  py={1.5}
                  borderBottom="1px solid var(--line-faint)"
                  fontSize="11.5px"
                  spacing={3}
                  fontFamily="var(--ff-mono)"
                  _last={{ borderBottom: 'none' }}
                >
                  <Text color="var(--fg-faint)" w="36px" flexShrink={0}>
                    {ago(tx.utime)}
                  </Text>
                  <Text
                    fontSize="9.5px"
                    letterSpacing="0.06em"
                    fontWeight="500"
                    color={tone.color}
                    w="56px"
                    flexShrink={0}
                  >
                    {tone.label}
                  </Text>
                  <Text color="var(--fg-mid)" flex={1} isTruncated>
                    {short(tx.address?.account_address)}
                  </Text>
                  <Text color={tone.color} fontWeight="500" flexShrink={0}>
                    +{fmtVal(tx.in_msg?.value)}
                  </Text>
                </HStack>
              );
            })}
          </VStack>
        )}
      </Box>
    </Grid>
  );
}

function ActorCard({ n, total, label, detail, tone }) {
  const pct = total > 0 ? (n / total) * 100 : 0;
  return (
    <Box
      bg="var(--bg-elev-1)"
      border="1px solid var(--line-faint)"
      borderRadius="var(--radius)"
      p={4}
      _hover={{ borderColor: 'var(--line)' }}
      sx={{ transition: 'border-color 150ms var(--ease)' }}
    >
      <Text fontSize="11px" color="var(--fg-dim)" fontWeight="500" mb={3}>
        {label}
      </Text>

      <HStack align="baseline" spacing={1.5} mb={2}>
        <Text fontSize="28px" fontWeight="500" color={tone} lineHeight="1"
              sx={{ letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
          {n}
        </Text>
        <Text fontSize="14px" color="var(--fg-faint)" fontFamily="var(--ff-mono)">
          / {total}
        </Text>
      </HStack>

      <Text fontSize="11px" color="var(--fg-faint)" mb={3}>
        {detail}
      </Text>

      <Box h="2px" bg="var(--line-faint)" borderRadius="1px" overflow="hidden">
        <Box h="100%" w={`${pct}%`} bg={tone}
             sx={{ transition: 'width 600ms var(--ease)' }} />
      </Box>
    </Box>
  );
}
