import { Card, CardBody, CardHeader, Heading, Box, HStack, VStack, Text } from '@chakra-ui/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#38B2AC', '#805AD5', '#DD6B20', '#4299E1'];

export default function SpendBreakdown({ data }) {
  const hasData = data && data.length > 0 && data.some(d => d.value > 0);

  return (
    <Card>
      <CardHeader pb={0}>
        <Heading size="sm" color="white">TON Spend Breakdown</Heading>
      </CardHeader>
      <CardBody>
        {!hasData ? (
          <Box h="250px" display="flex" alignItems="center" justifyContent="center">
            <Text color="gray.500">No spend data yet</Text>
          </Box>
        ) : (
          <HStack spacing={4} align="center">
            <ResponsiveContainer width="60%" height={220}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.map((entry, idx) => (
                    <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }}
                  formatter={(value) => [`${value.toFixed(4)} TON`]}
                />
              </PieChart>
            </ResponsiveContainer>
            <VStack spacing={3} align="start" flex={1}>
              {data.map((entry, idx) => (
                <HStack key={entry.name} spacing={2}>
                  <Box w={3} h={3} borderRadius="sm" bg={COLORS[idx % COLORS.length]} />
                  <VStack spacing={0} align="start">
                    <Text fontSize="xs" color="gray.400">{entry.name}</Text>
                    <Text fontSize="sm" color="white" fontWeight="bold">
                      {entry.value.toFixed(4)} TON
                    </Text>
                  </VStack>
                </HStack>
              ))}
            </VStack>
          </HStack>
        )}
      </CardBody>
    </Card>
  );
}
