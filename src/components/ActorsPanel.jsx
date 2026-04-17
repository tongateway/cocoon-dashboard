import { Box, Grid, Text, HStack, VStack } from '@chakra-ui/react';
import { activeWorkers, activeClients, inWindow } from '../lib/rateMath';
import { classifyTx, TX_TYPE_LABEL } from '../lib/txClassify';

const ACTIVE_MS = 60 * 60 * 1000; // fixed 1h per spec

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
    .slice(0, 10);

  return (
    <Box>
      <Text fontSize="11px" textTransform="uppercase" color="#7d8590" letterSpacing="0.1em" mb={3} fontWeight="600">
        Who's active right now
      </Text>
      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr 1.4fr' }} gap={3}>
        <ActorBox n={activeW} total={totalWorkers} label="Workers earning (1h)"
                  detail={`${activeW} received payouts · ${Math.max(0, totalWorkers - activeW)} idle`} />
        <ActorBox n={activeC} total={totalClients} label="Clients spending (1h)"
                  detail={`${activeC} charged inference · ${Math.max(0, totalClients - activeC)} idle`} />
        <Box bg="#161b22" border="1px solid #30363d" borderRadius="10px" p={3}>
          <Text fontSize="11px" textTransform="uppercase" color="#7d8590" letterSpacing="0.08em" mb={2}>
            Live event feed
          </Text>
          <VStack spacing={0} align="stretch">
            {feed.length === 0 && <Text fontSize="11px" color="#7d8590">Waiting for events…</Text>}
            {feed.map(tx => {
              const info = TX_TYPE_LABEL[tx._type];
              return (
                <HStack key={tx.id} justify="space-between" py={1}
                        borderBottom="1px solid rgba(48,54,61,0.5)" fontFamily="mono" fontSize="11px">
                  <Text color="#7d8590" w="40px">{ago(tx.utime)}</Text>
                  <HStack flex={1} spacing={2}>
                    <Box as="span" fontSize="9px" px={1.5} py={0.5} borderRadius="3px"
                         bg={info.bg} color={info.color} textTransform="uppercase" letterSpacing="0.04em">
                      {info.label}
                    </Box>
                    <Text color="#58a6ff">{short(tx.address?.account_address)}</Text>
                  </HStack>
                  <Text color="#3fb950" fontWeight="600">+{fmtVal(tx.in_msg?.value)}</Text>
                </HStack>
              );
            })}
          </VStack>
        </Box>
      </Grid>
    </Box>
  );
}

function ActorBox({ n, total, label, detail }) {
  const pct = total > 0 ? (n / total) * 100 : 0;
  return (
    <Box bg="#161b22" border="1px solid #30363d" borderRadius="10px" p={3}>
      <Text fontSize="36px" fontWeight="700" color="#f0f6fc" lineHeight="1">
        {n}<Text as="span" fontSize="15px" color="#7d8590" fontWeight="400">{` / ${total}`}</Text>
      </Text>
      <Text fontSize="11px" textTransform="uppercase" color="#7d8590" letterSpacing="0.08em" mt={2}>{label}</Text>
      <Text fontSize="11px" color="#8b949e" mt={2}>{detail}</Text>
      <Box h="4px" bg="#30363d" borderRadius="2px" mt={3} overflow="hidden">
        <Box h="100%" w={`${pct}%`} bgGradient="linear(to-r, #3fb950, #58a6ff)" />
      </Box>
    </Box>
  );
}
