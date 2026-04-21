import { Box, HStack, Text } from '@chakra-ui/react';
import { networkHealth } from '../lib/rateMath';

function fmtDur(sec) {
  if (sec == null) return '—';
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

const STATES = {
  healthy: { label: 'Healthy', tone: 'ok',   blurb: 'Network is processing inference in real time.' },
  quiet:   { label: 'Quiet',   tone: 'warn', blurb: 'Activity in the last hour; nothing in the last 5 minutes.' },
  stalled: { label: 'Stalled', tone: 'warn', blurb: 'No transactions in the last hour.' },
  dormant: { label: 'Dormant', tone: 'err',  blurb: 'No activity in the last 24 hours.' },
};

const TONES = {
  ok:   { text: 'var(--ok)',   ring: 'var(--ok-ring)',   edge: 'var(--ok-edge)',   wash: 'var(--ok-wash)' },
  warn: { text: 'var(--warn)', ring: 'var(--warn-ring)', edge: 'var(--warn-edge)', wash: 'var(--warn-wash)' },
  err:  { text: 'var(--err)',  ring: 'var(--err-ring)',  edge: 'var(--err-edge)',  wash: 'var(--err-wash)' },
};

// eslint-disable-next-line no-unused-vars
export default function NetworkHealth({ bufferRef, bufferVersion }) {
  const h = networkHealth(bufferRef.items());
  const state = STATES[h.status];
  const t = TONES[state.tone];
  const pulsing = h.status === 'healthy';

  return (
    <Box
      sx={{
        background: 'var(--bg-1)',
        border: '1px solid var(--line-soft)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
      }}
    >
      <HStack spacing="10px" align="center" flex={1} minW="240px">
        <Box
          sx={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: t.text,
            boxShadow: `0 0 0 3px ${t.ring}`,
            animation: pulsing ? 'pulse-dot 2.4s infinite' : 'none',
          }}
        />
        <Text fontSize="13px" fontWeight="600" color={t.text}>{state.label}</Text>
        <Text fontSize="12.5px" color="var(--fg-2)">{state.blurb}</Text>
      </HStack>

      <HStack spacing="18px" fontSize="11.5px" className="mono" color="var(--fg-2)" flexWrap="wrap">
        <Fact label="last tx" value={h.lastTxAgoSec == null ? '—' : `${fmtDur(h.lastTxAgoSec)} ago`} />
        <Fact label="1h" value={`${h.last1hCount} tx`} />
        {h.lastOlderActivityAgoSec != null && (
          <Fact label="prior" value={`${fmtDur(h.lastOlderActivityAgoSec)} ago`} />
        )}
      </HStack>
    </Box>
  );
}

function Fact({ label, value }) {
  return (
    <HStack spacing="6px">
      <Text color="var(--fg-3)">{label}</Text>
      <Text color="var(--fg-0)">{value}</Text>
    </HStack>
  );
}
