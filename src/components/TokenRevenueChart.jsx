import { Card, CardBody, CardHeader, Heading, Box, Text, HStack, Badge } from '@chakra-ui/react';
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

export default function TokenRevenueChart({ volumeData }) {
  const chartData = useMemo(() => {
    if (!volumeData || volumeData.length === 0) return [];
    return volumeData.map(d => ({
      date: d.date,
      tokens: Math.round(d.tokensEstimated || 0),
      revenue: parseFloat((d.revenue || 0).toFixed(4)),
      txCount: d.txCount || 0,
    })).filter(d => d.tokens > 0 || d.revenue > 0);
  }, [volumeData]);

  // Totals
  const totals = useMemo(() => {
    let tokens = 0, revenue = 0;
    for (const d of chartData) { tokens += d.tokens; revenue += d.revenue; }
    return { tokens, revenue };
  }, [chartData]);

  return (
    <Card>
      <CardHeader pb={0}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Heading size="sm" color="white">Tokens & Revenue</Heading>
          <HStack spacing={3}>
            <Badge colorScheme="cyan" variant="subtle" px={2} py={1}>
              {formatTokens(totals.tokens)} tokens
            </Badge>
            <Badge colorScheme="green" variant="subtle" px={2} py={1}>
              {totals.revenue.toFixed(2)} TON revenue
            </Badge>
          </HStack>
        </Box>
      </CardHeader>
      <CardBody>
        {chartData.length === 0 ? (
          <Box h="280px" display="flex" alignItems="center" justifyContent="center">
            <Text color="gray.500">No token usage data yet</Text>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
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
                yAxisId="revenue"
                orientation="right"
                stroke="#48BB78"
                fontSize={10}
                tickFormatter={v => `${v.toFixed(1)}`}
              />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }}
                labelStyle={{ color: '#8b949e' }}
                formatter={(value, name) => {
                  if (name === 'tokens') return [formatTokens(value), 'Tokens (est.)'];
                  if (name === 'revenue') return [`${value.toFixed(4)} TON`, 'Revenue'];
                  return [value, name];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#8b949e' }}
                formatter={(value) => value === 'tokens' ? 'Tokens (est.)' : 'Revenue (TON)'}
              />
              <Bar yAxisId="tokens" dataKey="tokens" fill="url(#tokenGrad)" radius={[4, 4, 0, 0]} barSize={20} />
              <Line yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#48BB78" strokeWidth={2} dot={{ r: 3, fill: '#48BB78' }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  );
}
