import { Box, Grid, Text, HStack, VStack } from '@chakra-ui/react';
import { activeWorkers, activeClients, inWindow } from '../lib/rateMath';
import { classifyTx, TX_TYPE_LABEL } from '../lib/txClassify';

const ACTIVE_MS = 60 * 60 * 1000; // fixed 1h per spec

// Updated palette for the badges — tone-matched to the new design system
const TX_TONES = {
  worker_payout: { label: 'Payout',  color: 'var(--mint)'  },
  client_charge: { label: 'Charge',  color: 'var(--dusk)'  },
  top_up:        { label: 'Top-up',  color: 'var(--honey)' },
  proxy_fee:     { label: 'Fee',     color: 'var(--ink-mid)' },
  other:         { label: '—',       color: 'var(--ink-low)' },
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
    <Box className="fade-up-5">
      <HStack spacing={4} align="baseline" flexWrap="wrap" mb={5}>
        <Text fontSize="11px" fontFamily="var(--ff-mono)" letterSpacing="0.24em" textTransform="uppercase" color="var(--ink-low)">
          § V · Roll call
        </Text>
        <Text fontFamily="var(--ff-display)" fontStyle="italic" fontSize="16px" color="var(--ink-mid)"
              sx={{ fontVariationSettings: '"opsz" 18, "SOFT" 80' }}>
          who's active in the last hour · and what's happening now
        </Text>
      </HStack>

      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr 1.6fr' }} gap={0}
            borderTop="1px solid var(--line-faint)"
            borderBottom="1px solid var(--line-faint)"
            sx={{
              '& > div': { borderRight: { base: 'none', lg: '1px solid var(--line-faint)' } },
              '& > div:last-child': { borderRight: 'none' },
              '& > div:not(:first-of-type)': { borderTop: { base: '1px solid var(--line-faint)', lg: 'none' } },
            }}>
        <ActorBox
          n={activeW}
          total={totalWorkers}
          label="Workers earning"
          tone="var(--mint)"
          detail={`${activeW} received payouts · ${Math.max(0, totalWorkers - activeW)} idle`}
        />
        <ActorBox
          n={activeC}
          total={totalClients}
          label="Clients spending"
          tone="var(--dusk)"
          detail={`${activeC} charged inference · ${Math.max(0, totalClients - activeC)} idle`}
        />

        <Box p={{ base: 5, md: 6 }}>
          <Text fontSize="10px" fontFamily="var(--ff-body)" letterSpacing="0.22em" textTransform="uppercase"
                color="var(--ink-low)" fontWeight="500" mb={3}>
            Live event feed
          </Text>
          <VStack spacing={0} align="stretch">
            {feed.length === 0 && (
              <Text fontSize="13px" color="var(--ink-low)" fontFamily="var(--ff-display)" fontStyle="italic"
                    sx={{ fontVariationSettings: '"opsz" 14, "SOFT" 80' }}>
                awaiting transactions…
              </Text>
            )}
            {feed.map((tx) => {
              const tone = TX_TONES[tx._type] || TX_TONES.other;
              const info = TX_TYPE_LABEL[tx._type];
              return (
                <HStack
                  key={tx.id}
                  justify="space-between"
                  py={1.5}
                  borderBottom="1px solid var(--line-faint)"
                  fontFamily="var(--ff-mono)"
                  fontSize="11.5px"
                  spacing={3}
                  _last={{ borderBottom: 'none' }}
                >
                  <Text color="var(--ink-faint)" w="42px" flexShrink={0}>
                    {ago(tx.utime)}
                  </Text>
                  <HStack flex={1} spacing={3} overflow="hidden">
                    <Box
                      as="span"
                      fontSize="9px"
                      px={1.5}
                      borderRadius="1px"
                      border={`1px solid ${tone.color}`}
                      color={tone.color}
                      textTransform="uppercase"
                      letterSpacing="0.12em"
                      fontWeight="500"
                      flexShrink={0}
                      title={info?.label || tx._type}
                    >
                      {tone.label}
                    </Box>
                    <Text color="var(--ink-mid)" isTruncated>
                      {short(tx.address?.account_address)}
                    </Text>
                  </HStack>
                  <Text color={tone.color} fontWeight="500" flexShrink={0}>
                    +{fmtVal(tx.in_msg?.value)}
                  </Text>
                </HStack>
              );
            })}
          </VStack>
        </Box>
      </Grid>
    </Box>
  );
}

function ActorBox({ n, total, label, detail, tone }) {
  const pct = total > 0 ? (n / total) * 100 : 0;
  return (
    <Box p={{ base: 5, md: 6 }}>
      <Text fontSize="10px" fontFamily="var(--ff-body)" letterSpacing="0.22em" textTransform="uppercase"
            color="var(--ink-low)" fontWeight="500" mb={3}>
        {label}
      </Text>

      <HStack align="baseline" spacing={2}>
        <Text
          fontFamily="var(--ff-display)"
          fontSize={{ base: '54px', md: '72px' }}
          color={tone}
          fontWeight="300"
          sx={{
            fontVariationSettings: '"opsz" 144, "SOFT" 10',
            letterSpacing: '-0.04em',
            lineHeight: 0.9,
          }}
        >
          {n}
        </Text>
        <Text
          fontFamily="var(--ff-display)"
          fontStyle="italic"
          fontSize="22px"
          color="var(--ink-mid)"
          sx={{ fontVariationSettings: '"opsz" 48, "SOFT" 100' }}
        >
          ⁄ {total}
        </Text>
      </HStack>

      <Text
        fontFamily="var(--ff-display)"
        fontStyle="italic"
        fontSize="13px"
        color="var(--ink-mid)"
        sx={{ fontVariationSettings: '"opsz" 14, "SOFT" 80' }}
        mt={2}
      >
        {detail}
      </Text>

      {/* Progress line */}
      <Box h="1px" bg="var(--line-faint)" mt={4} overflow="hidden" position="relative">
        <Box
          position="absolute"
          inset={0}
          w={`${pct}%`}
          bg={tone}
          sx={{ transition: 'width 600ms var(--ease-soft)' }}
          opacity={0.8}
        />
      </Box>
    </Box>
  );
}
