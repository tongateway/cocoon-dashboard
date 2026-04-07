import { Card, CardBody, CardHeader, Heading, Box, Text, HStack, Badge, SimpleGrid } from '@chakra-ui/react';
import { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

function formatTokens(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(Math.round(n));
}

export default function TokenRevenueChart({ computeMetrics }) {
  if (!computeMetrics) return null;

  const { daily, totals } = computeMetrics;

  const chartData = useMemo(() => {
    return (daily || []).map(d => ({
      date: d.date,
      tokens: d.tokensMix || 0,
      spend: d.computeSpendTon || 0,
      revenue: d.workerRevenueTon || 0,
      txs: d.computeTxs || 0,
    }));
  }, [daily]);

  const hasData = chartData.length > 0 && totals.computeSpendTon > 0;

  return (
    <Card>
      <CardHeader pb={0}>
        <Heading size="sm" color="white" mb={3}>Tokens & Revenue</Heading>
        {/* Summary stats */}
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={2}>
          <Box>
            <Text fontSize="xs" color="gray.500">Compute Spend</Text>
            <Text fontSize="lg" color="orange.300" fontWeight="bold">{totals.computeSpendTon.toFixed(4)} TON</Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500">Worker Revenue</Text>
            <Text fontSize="lg" color="green.300" fontWeight="bold">{totals.workerRevenueTon.toFixed(4)} TON</Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500">Tokens (prompt est.)</Text>
            <Text fontSize="lg" color="cyan.300" fontWeight="bold">{formatTokens(totals.tokensPrompt)}</Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500">Tokens (completion est.)</Text>
            <Text fontSize="lg" color="purple.300" fontWeight="bold">{formatTokens(totals.tokensCompletion)}</Text>
          </Box>
        </SimpleGrid>
        <Text fontSize="xs" color="gray.600">
          Based on real compute opcodes (client_proxy_request, worker payouts). Price: 20 nanoTON/token base.
        </Text>
      </CardHeader>
      <CardBody>
        {!hasData ? (
          <Box h="250px" display="flex" alignItems="center" justifyContent="center">
            <Text color="gray.500">No compute transactions found</Text>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4299E1" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#4299E1" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis dataKey="date" tickFormatter={d => d.slice(5)} stroke="#484f58" fontSize={11} />
              <YAxis
                yAxisId="tokens"
                stroke="#4299E1"
                fontSize={10}
                tickFormatter={v => formatTokens(v)}
              />
              <YAxis
                yAxisId="ton"
                orientation="right"
                stroke="#48BB78"
                fontSize={10}
                tickFormatter={v => v.toFixed(2)}
              />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }}
                labelStyle={{ color: '#8b949e' }}
                formatter={(value, name) => {
                  if (name === 'tokens') return [formatTokens(value), 'Tokens (~3x mix)'];
                  if (name === 'spend') return [value.toFixed(4) + ' TON', 'Compute Spend'];
                  if (name === 'revenue') return [value.toFixed(4) + ' TON', 'Worker Revenue'];
                  return [value, name];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#8b949e' }}
                formatter={(v) => v === 'tokens' ? 'Tokens (~3x mix)' : v === 'spend' ? 'Compute Spend (TON)' : 'Worker Revenue (TON)'}
              />
              <Bar yAxisId="tokens" dataKey="tokens" fill="url(#tokenGrad)" radius={[4, 4, 0, 0]} barSize={20} />
              <Line yAxisId="ton" type="monotone" dataKey="spend" stroke="#DD6B20" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="ton" type="monotone" dataKey="revenue" stroke="#48BB78" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  );
}
