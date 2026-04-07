import { Card, CardBody, CardHeader, Heading, ButtonGroup, Button, Box, Text } from '@chakra-ui/react';
import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const PERIODS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: 'All', days: Infinity },
];

export default function TransactionChart({ volumeData }) {
  const [period, setPeriod] = useState(30);

  const filteredData = useMemo(() => {
    if (!volumeData || volumeData.length === 0) return [];
    if (period === Infinity) return volumeData;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return volumeData.filter(d => d.date >= cutoffStr);
  }, [volumeData, period]);

  return (
    <Card>
      <CardHeader pb={0}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Heading size="sm" color="white">Transaction Volume</Heading>
          <ButtonGroup size="xs" variant="outline">
            {PERIODS.map(p => (
              <Button
                key={p.label}
                onClick={() => setPeriod(p.days)}
                colorScheme={period === p.days ? 'teal' : 'gray'}
                variant={period === p.days ? 'solid' : 'outline'}
              >
                {p.label}
              </Button>
            ))}
          </ButtonGroup>
        </Box>
      </CardHeader>
      <CardBody>
        {filteredData.length === 0 ? (
          <Box h="250px" display="flex" alignItems="center" justifyContent="center">
            <Text color="gray.500">No transaction data yet</Text>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={filteredData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38B2AC" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38B2AC" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis dataKey="date" tickFormatter={d => d.slice(5)} stroke="#484f58" fontSize={11} />
              <YAxis stroke="#484f58" fontSize={11} tickFormatter={v => `${v.toFixed(1)}`} />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }}
                labelStyle={{ color: '#8b949e' }}
                itemStyle={{ color: '#38B2AC' }}
                formatter={(value) => [`${value.toFixed(4)} TON`, 'Volume']}
              />
              <Area type="monotone" dataKey="volume" stroke="#38B2AC" strokeWidth={2} fill="url(#volumeGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  );
}
