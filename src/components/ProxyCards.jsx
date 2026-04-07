import {
  Card, CardBody, CardHeader, Heading,
  SimpleGrid, Box, HStack, VStack, Text, Badge,
} from '@chakra-ui/react';
import AddressCell from './AddressCell';
import { nanoToTon, timeAgo } from '../lib/formatters';

export default function ProxyCards({ proxies }) {
  const proxyList = proxies ? [...proxies.values()] : [];

  return (
    <Card>
      <CardHeader pb={2}>
        <Heading size="sm" color="white">Network Topology</Heading>
      </CardHeader>
      <CardBody>
        {proxyList.length === 0 ? (
          <Box py={8} textAlign="center">
            <Text color="gray.500">Discovering proxies...</Text>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
            {proxyList.map(proxy => (
              <Box
                key={proxy.address}
                p={4}
                borderRadius="lg"
                border="1px"
                borderColor="#30363d"
                bg="#0d1117"
                _hover={{ borderColor: 'brand.600' }}
                transition="border-color 0.2s"
              >
                <HStack justify="space-between" mb={3}>
                  <Badge colorScheme={proxy.state === 'active' ? 'green' : 'red'} variant="subtle">
                    {proxy.state}
                  </Badge>
                  <Text fontSize="xs" color="gray.500">
                    {proxy.lastActivity ? timeAgo(proxy.lastActivity) : 'unknown'}
                  </Text>
                </HStack>

                <AddressCell address={proxy.address} />

                <HStack mt={3} spacing={4}>
                  <VStack spacing={0} align="start">
                    <Text fontSize="xs" color="gray.500">Balance</Text>
                    <Text fontSize="sm" color="white" fontWeight="bold">
                      {nanoToTon(proxy.balance).toFixed(2)} TON
                    </Text>
                  </VStack>
                  <VStack spacing={0} align="start">
                    <Text fontSize="xs" color="gray.500">Clients</Text>
                    <Text fontSize="sm" color="cyan.400" fontWeight="bold">
                      {proxy.clients?.size || 0}
                    </Text>
                  </VStack>
                  <VStack spacing={0} align="start">
                    <Text fontSize="xs" color="gray.500">Workers</Text>
                    <Text fontSize="sm" color="orange.400" fontWeight="bold">
                      {proxy.workers?.size || 0}
                    </Text>
                  </VStack>
                </HStack>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </CardBody>
    </Card>
  );
}
