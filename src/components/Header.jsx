import { Box, Flex, HStack, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

export default function Header({ connected, lastRefresh, fallbackPoll }) {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <Box
      as="header"
      position="sticky"
      top={0}
      zIndex={20}
      backdropFilter="saturate(1.4) blur(12px)"
      bg="rgba(10, 11, 14, 0.72)"
      borderBottom="1px solid var(--line-faint)"
    >
      {/* Dateline rail — editorial "gazette" header */}
      <Flex
        align="center"
        justify="space-between"
        px={{ base: 5, md: 10 }}
        py={2}
        borderBottom="1px solid var(--line-faint)"
        fontSize="10px"
        letterSpacing="0.18em"
        textTransform="uppercase"
        color="var(--ink-low)"
        fontWeight="500"
        fontFamily="var(--ff-mono)"
        flexWrap="wrap"
        gap={3}
      >
        <Text>Vol. I · The Cocoon Network Gazette</Text>
        <HStack spacing={4} display={{ base: 'none', md: 'flex' }}>
          <Text>{today}</Text>
          <Text color={connected ? 'var(--mint)' : 'var(--coral)'}>
            {connected ? '◆ Stream connected' : '◇ Stream offline'}
          </Text>
          {lastRefresh && (
            <Text>Snapshot · {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
          )}
        </HStack>
      </Flex>

      {/* Masthead */}
      <Flex
        as={RouterLink}
        to="/"
        align="baseline"
        justify="space-between"
        px={{ base: 5, md: 10 }}
        py={{ base: 4, md: 6 }}
        gap={4}
        flexWrap="wrap"
        _hover={{ opacity: 0.94 }}
        sx={{ transition: 'opacity 200ms var(--ease-soft)' }}
      >
        <Box flex="1" minW="260px">
          <Text
            fontSize="11px"
            color="var(--honey)"
            letterSpacing="0.28em"
            textTransform="uppercase"
            mb={1}
            fontWeight="500"
            fontFamily="var(--ff-body)"
          >
            Live Network Ledger
          </Text>
          <Box
            fontFamily="var(--ff-display)"
            fontSize={{ base: '36px', md: '52px', lg: '64px' }}
            color="var(--ink-high)"
            fontWeight="300"
            sx={{
              fontVariationSettings: '"opsz" 144, "SOFT" 30',
              letterSpacing: '-0.025em',
              lineHeight: 0.95,
            }}
          >
            Cocoon
            <Box
              as="span"
              color="var(--honey)"
              ml={3}
              fontStyle="italic"
              fontWeight="300"
              sx={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}
            >
              Network
            </Box>
          </Box>
          <Text mt={2} fontSize="13px" color="var(--ink-mid)" letterSpacing="0.005em">
            Decentralized AI inference · settled on TON · public read-only dashboard
          </Text>
        </Box>

        <Box textAlign={{ base: 'left', md: 'right' }}>
          {fallbackPoll && (
            <Text fontSize="10px" color="var(--coral)" letterSpacing="0.12em" textTransform="uppercase"
                  fontFamily="var(--ff-mono)" mb={2}>
              Live stream offline · polling cache
            </Text>
          )}
          <HStack spacing={2} justify={{ base: 'flex-start', md: 'flex-end' }} align="center">
            <Box
              w="10px"
              h="10px"
              borderRadius="50%"
              bg={connected ? 'var(--mint)' : 'var(--coral)'}
              sx={{ animation: connected ? 'pulse-halo 2.4s infinite var(--ease-soft)' : 'none' }}
            />
            <Text fontSize="11px" color={connected ? 'var(--mint)' : 'var(--coral)'}
                  letterSpacing="0.22em" textTransform="uppercase" fontWeight="500"
                  fontFamily="var(--ff-mono)">
              {connected ? 'Live' : 'Offline'}
            </Text>
          </HStack>
        </Box>
      </Flex>
    </Box>
  );
}
