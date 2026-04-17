import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { networkHealth } from '../lib/rateMath';

function fmtDur(sec) {
  if (sec == null) return '—';
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

const STATES = {
  healthy: { label: 'Healthy', tone: 'var(--ok)',    blurb: 'Processing inference in real time.' },
  quiet:   { label: 'Quiet',   tone: 'var(--warn)',  blurb: 'Some activity in the last hour, nothing in the last 5 minutes.' },
  stalled: { label: 'Stalled', tone: 'var(--warn)',  blurb: 'No transactions in the last hour.' },
  dormant: { label: 'Dormant', tone: 'var(--err)',   blurb: 'No activity in the last 24 hours.' },
};

// eslint-disable-next-line no-unused-vars
export default function NetworkHealth({ bufferRef, bufferVersion }) {
  const h = networkHealth(bufferRef.items());
  const state = STATES[h.status];

  return (
    <Box
      bg="var(--bg-elev-1)"
      border="1px solid var(--line-faint)"
      borderRadius="var(--radius)"
      p={4}
      className="fade-in"
    >
      <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
        <HStack spacing={3} align="center">
          <Box
            w="8px"
            h="8px"
            borderRadius="50%"
            bg={state.tone}
            sx={{ animation: h.status === 'healthy' ? 'pulse-dot 2s infinite' : 'none' }}
          />
          <VStack spacing={0.5} align="start">
            <HStack spacing={2} align="baseline">
              <Text fontSize="13px" fontWeight="600" color={state.tone}>
                {state.label}
              </Text>
              <Text fontSize="12px" color="var(--fg-mid)">
                {state.blurb}
              </Text>
            </HStack>
          </VStack>
        </HStack>

        <HStack spacing={5} fontSize="11px" fontFamily="var(--ff-mono)" color="var(--fg-dim)">
          <Fact label="last tx" value={h.lastTxAgoSec == null ? '—' : `${fmtDur(h.lastTxAgoSec)} ago`} />
          <Fact label="1h" value={`${h.last1hCount} tx`} />
          {h.lastOlderActivityAgoSec != null && (
            <Fact label="prior" value={`${fmtDur(h.lastOlderActivityAgoSec)} ago`} />
          )}
        </HStack>
      </HStack>
    </Box>
  );
}

function Fact({ label, value }) {
  return (
    <HStack spacing={1.5}>
      <Text color="var(--fg-faint)">{label}</Text>
      <Text color="var(--fg)">{value}</Text>
    </HStack>
  );
}
