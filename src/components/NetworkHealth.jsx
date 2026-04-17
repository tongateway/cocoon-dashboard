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
  healthy: {
    glyph: '◆',
    tint: 'var(--mint)',
    wash: 'linear-gradient(100deg, rgba(130, 213, 167, 0.1), rgba(130, 213, 167, 0.02) 60%, transparent)',
    blurb: 'Network is processing inference in real time.',
  },
  quiet: {
    glyph: '◈',
    tint: 'var(--honey)',
    wash: 'linear-gradient(100deg, rgba(232, 198, 116, 0.1), rgba(232, 198, 116, 0.02) 60%, transparent)',
    blurb: 'Some activity in the last hour; nothing in the last five minutes.',
  },
  stalled: {
    glyph: '◇',
    tint: 'var(--coral)',
    wash: 'linear-gradient(100deg, rgba(245, 139, 124, 0.08), rgba(245, 139, 124, 0.02) 60%, transparent)',
    blurb: 'No transactions in the last hour. The network may be paused.',
  },
  dormant: {
    glyph: '○',
    tint: 'var(--coral)',
    wash: 'linear-gradient(100deg, rgba(245, 139, 124, 0.08), rgba(245, 139, 124, 0.02) 60%, transparent)',
    blurb: 'No activity in the last 24 hours. Check worker and proxy availability.',
  },
};

// eslint-disable-next-line no-unused-vars
export default function NetworkHealth({ bufferRef, bufferVersion }) {
  const h = networkHealth(bufferRef.items());
  const state = STATES[h.status];

  return (
    <Box
      position="relative"
      borderTop="1px solid var(--line)"
      borderBottom="1px solid var(--line)"
      py={{ base: 7, md: 10 }}
      px={{ base: 1, md: 2 }}
      overflow="hidden"
      className="fade-up"
    >
      {/* washing glow tint matched to state */}
      <Box position="absolute" inset={0} pointerEvents="none" bg={state.wash} />

      <HStack align="flex-start" spacing={{ base: 4, md: 8 }} position="relative">
        {/* Big state glyph with glow */}
        <Box
          w={{ base: '42px', md: '56px' }}
          h={{ base: '42px', md: '56px' }}
          borderRadius="50%"
          bg="rgba(0, 0, 0, 0.3)"
          border="1px solid var(--line-strong)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
          color={state.tint}
          fontSize={{ base: '20px', md: '26px' }}
          sx={{
            boxShadow: h.status === 'healthy' ? `0 0 32px ${state.tint}40` : 'none',
            animation: h.status === 'healthy' ? 'pulse-halo 2.4s infinite var(--ease-soft)' : 'none',
          }}
        >
          {state.glyph}
        </Box>

        <VStack align="stretch" spacing={2} flex={1}>
          <Text
            fontSize="11px"
            fontFamily="var(--ff-mono)"
            letterSpacing="0.24em"
            textTransform="uppercase"
            color="var(--ink-low)"
            fontWeight="500"
          >
            § I · Status Report
          </Text>

          <Box
            fontFamily="var(--ff-display)"
            fontSize={{ base: '42px', md: '68px', lg: '84px' }}
            color={state.tint}
            fontWeight="300"
            sx={{
              fontVariationSettings: '"opsz" 144, "SOFT" 20',
              letterSpacing: '-0.03em',
              lineHeight: 0.95,
            }}
          >
            {h.label}
          </Box>

          <Text
            mt={1}
            fontFamily="var(--ff-display)"
            fontStyle="italic"
            fontSize={{ base: '16px', md: '20px' }}
            color="var(--ink-mid)"
            sx={{ fontVariationSettings: '"opsz" 24, "SOFT" 80' }}
            letterSpacing="-0.005em"
          >
            {state.blurb}
          </Text>

          <HStack
            spacing={{ base: 4, md: 8 }}
            flexWrap="wrap"
            mt={4}
            fontFamily="var(--ff-mono)"
            fontSize="11px"
            color="var(--ink-mid)"
            letterSpacing="-0.005em"
          >
            <Fact label="Last tx" value={h.lastTxAgoSec == null ? '—' : `${fmtDur(h.lastTxAgoSec)} ago`} emphasis={state.tint} />
            <Fact label="Last hour" value={`${h.last1hCount} tx${h.last1hCount === 1 ? '' : 's'}`} />
            {h.lastOlderActivityAgoSec != null && (
              <Fact label="Prior activity" value={`${fmtDur(h.lastOlderActivityAgoSec)} ago`} muted />
            )}
          </HStack>
        </VStack>
      </HStack>
    </Box>
  );
}

function Fact({ label, value, emphasis, muted }) {
  return (
    <HStack spacing={2} align="baseline">
      <Text
        fontSize="10px"
        textTransform="uppercase"
        letterSpacing="0.2em"
        color="var(--ink-faint)"
        fontWeight="500"
      >
        {label}
      </Text>
      <Text
        fontSize="13px"
        color={emphasis || (muted ? 'var(--ink-low)' : 'var(--ink-high)')}
        fontFamily="var(--ff-mono)"
        fontWeight="500"
      >
        {value}
      </Text>
    </HStack>
  );
}
