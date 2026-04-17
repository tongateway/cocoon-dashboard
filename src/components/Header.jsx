import { Box, Flex, HStack, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

export default function Header({ connected, lastRefresh, fallbackPoll }) {
  return (
    <Box
      as="header"
      position="sticky"
      top={0}
      zIndex={20}
      bg="rgba(9, 9, 11, 0.85)"
      backdropFilter="saturate(1.4) blur(8px)"
      borderBottom="1px solid var(--line-faint)"
    >
      <Flex
        align="center"
        justify="space-between"
        px={{ base: 4, md: 6 }}
        h="52px"
        gap={3}
      >
        <HStack spacing={3} as={RouterLink} to="/" _hover={{ opacity: 0.85 }}>
          <Logo />
          <HStack spacing={2} align="baseline">
            <Text fontSize="14px" fontWeight="600" color="var(--fg)" letterSpacing="-0.01em">
              Cocoon Network
            </Text>
            <Text fontSize="11px" color="var(--fg-faint)" fontFamily="var(--ff-mono)">
              / live
            </Text>
          </HStack>
        </HStack>

        <HStack spacing={4} fontSize="12px">
          {fallbackPoll && (
            <HStack spacing={1.5}>
              <Box w="6px" h="6px" borderRadius="50%" bg="var(--warn)" />
              <Text color="var(--warn)" fontFamily="var(--ff-mono)" fontSize="11px">
                polling cache
              </Text>
            </HStack>
          )}
          <HStack spacing={1.5}>
            <Box
              w="6px" h="6px" borderRadius="50%"
              bg={connected ? 'var(--ok)' : 'var(--err)'}
              sx={{ animation: connected ? 'pulse-dot 2s infinite' : 'none' }}
            />
            <Text color={connected ? 'var(--fg-mid)' : 'var(--err)'} fontFamily="var(--ff-mono)" fontSize="11px">
              {connected ? 'connected' : 'disconnected'}
            </Text>
          </HStack>
          {lastRefresh && (
            <Text color="var(--fg-faint)" fontFamily="var(--ff-mono)" fontSize="11px"
                  display={{ base: 'none', md: 'block' }}>
              {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
          )}
        </HStack>
      </Flex>
    </Box>
  );
}

function Logo() {
  return (
    <Box
      w="22px"
      h="22px"
      borderRadius="5px"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="var(--accent)"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06170d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 3v18M3 12h18"/>
      </svg>
    </Box>
  );
}
