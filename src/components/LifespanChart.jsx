import { Box, HStack, Text } from '@chakra-ui/react';

function daysBetween(isoA, isoB) {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.round((b - a) / 86400000);
}

function fmtDate(iso) {
  const d = new Date(iso);
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
  return `${m} ${d.getUTCDate()}`;
}

function fmtTon(n) {
  if (n >= 1000) return `${(n/1000).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(1);
  if (n > 0) return n.toFixed(2);
  return '0';
}

// Build a contiguous daily series between first and last date (filling gaps with 0s)
function fillDaily(daily) {
  if (!daily || daily.length === 0) return [];
  const byDate = new Map(daily.map(d => [d.date, d]));
  const first = daily[0].date;
  const last = daily[daily.length - 1].date;
  const out = [];
  const cur = new Date(first);
  const end = new Date(last);
  while (cur <= end) {
    const iso = cur.toISOString().slice(0, 10);
    const row = byDate.get(iso);
    out.push({
      date: iso,
      computeSpendTon: row?.computeSpendTon || 0,
      computeTxs: row?.computeTxs || 0,
    });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export default function LifespanChart({ daily, totals }) {
  if (!daily || daily.length === 0) {
    return (
      <Box bg="#161b22" border="1px solid #30363d" borderRadius="10px" p={4}>
        <Text fontSize="13px" color="#8b949e">No historical activity data yet.</Text>
      </Box>
    );
  }

  const filled = fillDaily(daily);
  const firstDate = filled[0].date;
  const lastDate = filled[filled.length - 1].date;
  const todayIso = new Date().toISOString().slice(0, 10);
  const lifespanDays = daysBetween(firstDate, todayIso);
  const daysSinceLast = daysBetween(lastDate, todayIso);
  const activeDays = daily.filter(d => d.computeTxs > 0 || d.computeSpendTon > 0).length;

  const maxSpend = Math.max(1, ...filled.map(d => d.computeSpendTon));

  // SVG dims
  const W = 800, H = 140, PAD_L = 30, PAD_R = 10, PAD_T = 8, PAD_B = 22;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const barW = Math.max(1, plotW / filled.length - 1);

  return (
    <Box bg="#161b22" border="1px solid #30363d" borderRadius="10px" p={4}>
      <HStack justify="space-between" mb={2} align="baseline" flexWrap="wrap" gap={2}>
        <Text fontSize="13px" fontWeight="600" color="#e6edf3">
          Network lifespan · daily compute spend
        </Text>
        <HStack spacing={4} fontSize="11px" color="#8b949e" flexWrap="wrap">
          <Text>Running since <Box as="span" color="#e6edf3" fontWeight="500">{fmtDate(firstDate)}</Box> ({lifespanDays} days)</Text>
          <Text><Box as="span" color="#e6edf3">{activeDays}</Box> days with activity</Text>
          <Text><Box as="span" color={daysSinceLast <= 1 ? '#3fb950' : daysSinceLast <= 7 ? '#d29922' : '#f0883e'}>
            Last active day: {fmtDate(lastDate)}{daysSinceLast > 0 ? ` (${daysSinceLast}d ago)` : ' (today)'}
          </Box></Text>
          <Text>Total compute: <Box as="span" color="#e6edf3">{totals?.computeSpendTon?.toFixed(1) || '0'} TON</Box></Text>
        </HStack>
      </HStack>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
        {/* y-axis grid */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + plotH} stroke="#30363d" strokeWidth="0.5" />
        <line x1={PAD_L} y1={PAD_T + plotH} x2={W - PAD_R} y2={PAD_T + plotH} stroke="#30363d" strokeWidth="0.5" />
        <text x={PAD_L - 4} y={PAD_T + 4} fontSize="9" fill="#7d8590" textAnchor="end">{fmtTon(maxSpend)}</text>
        <text x={PAD_L - 4} y={PAD_T + plotH} fontSize="9" fill="#7d8590" textAnchor="end">0</text>

        {/* bars */}
        {filled.map((d, i) => {
          const h = (d.computeSpendTon / maxSpend) * plotH;
          const x = PAD_L + i * (plotW / filled.length);
          const y = PAD_T + plotH - h;
          const isActive = d.computeSpendTon > 0;
          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, isActive ? 1 : 0)}
              fill={isActive ? '#3fb950' : 'transparent'}
              opacity={isActive ? 0.8 : 0}
            >
              <title>{`${d.date}: ${d.computeSpendTon.toFixed(2)} TON · ${d.computeTxs} txs`}</title>
            </rect>
          );
        })}

        {/* x-axis labels — first, middle, last */}
        <text x={PAD_L} y={H - 6} fontSize="10" fill="#7d8590" textAnchor="start">{fmtDate(firstDate)}</text>
        <text x={PAD_L + plotW / 2} y={H - 6} fontSize="10" fill="#7d8590" textAnchor="middle">
          {fmtDate(filled[Math.floor(filled.length / 2)].date)}
        </text>
        <text x={W - PAD_R} y={H - 6} fontSize="10" fill="#7d8590" textAnchor="end">{fmtDate(lastDate)}</text>
      </svg>

      {daysSinceLast >= 2 && (
        <Text fontSize="11px" color="#d29922" mt={2}>
          ⚠ Last compute activity was {daysSinceLast} days ago — network may be paused.
        </Text>
      )}
    </Box>
  );
}
