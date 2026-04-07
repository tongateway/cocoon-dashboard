import { Box, Heading, Text } from '@chakra-ui/react';

export default function App() {
  return (
    <Box minH="100vh" p={8}>
      <Heading color="brand.400">Cocoon Network Dashboard</Heading>
      <Text color="gray.400" mt={2}>Loading...</Text>
    </Box>
  );
}
