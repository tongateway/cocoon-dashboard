import { Box, Flex, Heading, HStack, Text, IconButton, Tooltip } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import SearchInput from './SearchInput';

export default function Header({ isLive, lastRefresh, onRefresh, loading }) {
  return (
    <Flex
      as="header"
      align="center"
      justify="space-between"
      px={{ base: 4, md: 8 }}
      py={4}
      borderBottom="1px"
      borderColor="#30363d"
      bg="#0d1117"
      position="sticky"
      top={0}
      zIndex={10}
      gap={4}
      flexWrap="wrap"
    >
      <HStack spacing={4} as={RouterLink} to="/" _hover={{ opacity: 0.8 }} cursor="pointer">
        <CocoonLogo />
        <Box>
          <Heading size="md" color="white" letterSpacing="-0.02em">
            Cocoon Network
          </Heading>
          <Text fontSize="xs" color="gray.500">
            Decentralized AI Inference Dashboard
          </Text>
        </Box>
      </HStack>

      <HStack spacing={4} flexWrap="wrap">
        <SearchInput />

        <HStack spacing={2}>
          <Box
            w={2}
            h={2}
            borderRadius="full"
            bg={isLive ? 'green.400' : 'red.400'}
            boxShadow={isLive ? '0 0 8px rgba(72,187,120,0.6)' : 'none'}
          />
          <Text fontSize="sm" color={isLive ? 'green.400' : 'red.400'}>
            {isLive ? 'Live' : 'Offline'}
          </Text>
        </HStack>

        {lastRefresh && (
          <Text fontSize="xs" color="gray.500" display={{ base: 'none', md: 'block' }}>
            Updated {lastRefresh.toLocaleTimeString()}
          </Text>
        )}

        <Tooltip label="Refresh now" hasArrow>
          <IconButton
            icon={<RefreshIcon />}
            size="sm"
            variant="ghost"
            color="gray.400"
            _hover={{ color: 'white' }}
            onClick={onRefresh}
            isLoading={loading}
            aria-label="Refresh"
          />
        </Tooltip>
      </HStack>
    </Flex>
  );
}

function CocoonLogo() {
  return (
    <Box
      w={10}
      h={10}
      borderRadius="lg"
      bg="brand.400"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    </Box>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
  );
}
