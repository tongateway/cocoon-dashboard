import { Box, HStack, Text } from '@chakra-ui/react';
import { networkHealth } from '../lib/rateMath';

function fmtDur(sec) {
  if (sec == null) return '—';
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

const BG = {
  healthy: 'rgba(63,185,80,0.08)',
  quiet:   'rgba(210,153,34,0.08)',
  stalled: 'rgba(240,136,62,0.1)',
  dormant: 'rgba(248,81,73,0.1)',
};

const BORDER = {
  healthy: 'rgba(63,185,80,0.4)',
  quiet:   'rgba(210,153,34,0.4)',
  stalled: 'rgba(240,136,62,0.5)',
  dormant: 'rgba(248,81,73,0.5)',
};

const DESCRIPTIONS = {
  healthy: 'Cocoon is actively processing inference requests.',
  quiet:   'Some activity in the last hour but nothing in the last 5 minutes.',
  stalled: 'No activity in the last hour. The network may be paused.',
  dormant: 'No activity in the last 24 hours. Check worker/proxy availability.',
};

// eslint-disable-next-line no-unused-vars
export default function NetworkHealth({ bufferRef, bufferVersion }) {
  const h = networkHealth(bufferRef.items());
  const desc = DESCRIPTIONS[h.status];

  const lastTxStr = h.lastTxAgoSec == null ? 'no transactions in buffer' : `last tx ${fmtDur(h.lastTxAgoSec)} ago`;
  const hourStr = `${h.last1hCount} tx${h.last1hCount === 1 ? '' : 's'} in last hour`;
  const olderStr = h.lastOlderActivityAgoSec != null
    ? `previous activity ${fmtDur(h.lastOlderActivityAgoSec)} ago`
    : null;

  const summary = [lastTxStr, hourStr, olderStr].filter(Boolean).join(' · ');

  return (
    <Box
      bg={BG[h.status]}
      border="1px solid"
      borderColor={BORDER[h.status]}
      borderRadius="12px"
      p={4}
    >
      <HStack spacing={3} align="center" mb={2} flexWrap="wrap">
        <Box w="10px" h="10px" borderRadius="full" bg={h.color}
             boxShadow={h.status === 'healthy' ? '0 0 8px rgba(63,185,80,0.6)' : 'none'}
             sx={h.status === 'healthy' ? {
               animation: 'pulse-nh 1.4s infinite',
               '@keyframes pulse-nh': {
                 '0%': { boxShadow: '0 0 0 0 rgba(63,185,80,0.6)' },
                 '70%': { boxShadow: '0 0 0 12px rgba(63,185,80,0)' },
                 '100%': { boxShadow: '0 0 0 0 rgba(63,185,80,0)' }
               }
             } : {}} />
        <Text fontSize="22px" fontWeight="700" color={h.color} lineHeight="1" textTransform="uppercase" letterSpacing="0.02em">
          {h.label}
        </Text>
        <Text fontSize="13px" color="#c9d1d9">— {desc}</Text>
      </HStack>
      <Text fontSize="12px" color="#8b949e" fontFamily="mono">{summary}</Text>
    </Box>
  );
}
