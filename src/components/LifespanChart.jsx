import { useState, useMemo, useRef } from 'react';
import { Box, HStack, Text, Button } from '@chakra-ui/react';

function daysBetween(isoA, isoB) {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.round((b - a) / 86400000);
}

function fmtDate(iso, { withYear = false } = {}) {
  const d = new Date(iso);
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
  return withYear
    ? `${m} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
    : `${m} ${d.getUTCDate()}`;
}

function fmtTon(n) {
  if (n >= 1000) return `${(n/1000).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(1);
  if (n > 0) return n.toFixed(2);
  return '0';
}

function fmtNum(n) {
  if (!n) return '0';
  if (n >= 1e9) return `${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(0)}K`;
  return String(n);
}

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
      workerRevenueTon: row?.workerRevenueTon || 0,
      computeTxs: row?.computeTxs || 0,
      tokensMix: row?.tokensMix || 0,
    });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

const TIMEFRAMES = [
  { id: '1m', label: '1M', days: 30 },
  { id: '3m', label: '3M', days: 90 },
  { id: '6m', label: '6M', days: 180 },
  { id: 'all', label: 'All', days: Infinity },
];

function sliceForTimeframe(filled, tfId) {
  const tf = TIMEFRAMES.find(x => x.id === tfId) || TIMEFRAMES[TIMEFRAMES.length - 1];
  if (!isFinite(tf.days)) return filled;
  return filled.slice(Math.max(0, filled.length - tf.days));
}

function monthTickIndexes(filled) {
  // Return indexes whose day corresponds to the 1st of a month (month boundary).
  const out = [];
  let prev = '';
  for (let i = 0; i < filled.length; i++) {
    const m = filled[i].date.slice(0, 7); // YYYY-MM
    if (m !== prev) {
      out.push(i);
      prev = m;
    }
  }
  return out;
}

// SVG dims
const W = 800, H = 160;
const PAD_L = 36, PAD_R = 12, PAD_T = 10, PAD_B = 28;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

export default function LifespanChart({ daily, totals }) {
  const [timeframe, setTimeframe] = useState('all');
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);

  const filled = useMemo(() => fillDaily(daily), [daily]);
  const visible = useMemo(() => sliceForTimeframe(filled, timeframe), [filled, timeframe]);

  if (!filled.length) {
    return (
      <Box bg="#161b22" border="1px solid #30363d" borderRadius="10px" p={4}>
        <Text fontSize="13px" color="#8b949e">No historical activity data yet.</Text>
      </Box>
    );
  }

  const firstDate = filled[0].date;
  const lastDate = filled[filled.length - 1].date;
  const todayIso = new Date().toISOString().slice(0, 10);
  const lifespanDays = daysBetween(firstDate, todayIso);
  const daysSinceLast = daysBetween(lastDate, todayIso);
  const activeDays = daily.filter(d => d.computeTxs > 0 || d.computeSpendTon > 0).length;

  const maxSpend = Math.max(1, ...visible.map(d => d.computeSpendTon));
  const barStep = PLOT_W / visible.length;
  const barW = Math.max(1, barStep - 1);
  const ticks = monthTickIndexes(visible);

  const hovered = hoverIdx !== null ? visible[hoverIdx] : null;

  const handleMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const xSvg = ((e.clientX - rect.left) / rect.width) * W;
    if (xSvg < PAD_L || xSvg > W - PAD_R) {
      setHoverIdx(null);
      return;
    }
    const idx = Math.floor((xSvg - PAD_L) / barStep);
    if (idx >= 0 && idx < visible.length) setHoverIdx(idx);
    else setHoverIdx(null);
  };

  // Tooltip placement (as % of SVG width, which the Box overlay uses directly)
  const hoverXpct = hoverIdx !== null
    ? ((PAD_L + hoverIdx * barStep + barW / 2) / W) * 100
    : 0;

  return (
    <Box bg="#161b22" border="1px solid #30363d" borderRadius="10px" p={4}>
      <HStack justify="space-between" mb={2} align="baseline" flexWrap="wrap" gap={2}>
        <Text fontSize="13px" fontWeight="600" color="#e6edf3">
          Network lifespan · daily compute spend
        </Text>
        <HStack spacing={1}>
          {TIMEFRAMES.map(tf => (
            <Button
              key={tf.id}
              size="xs"
              onClick={() => { setTimeframe(tf.id); setHoverIdx(null); }}
              variant={timeframe === tf.id ? 'solid' : 'ghost'}
              bg={timeframe === tf.id ? 'rgba(63,185,80,0.15)' : 'transparent'}
              color={timeframe === tf.id ? '#3fb950' : 'gray.400'}
              borderWidth="1px"
              borderColor={timeframe === tf.id ? 'rgba(63,185,80,0.35)' : '#30363d'}
              borderRadius="md"
              _hover={{ bg: timeframe === tf.id ? 'rgba(63,185,80,0.2)' : '#21262d' }}
              fontWeight="500"
              fontSize="xs"
              px={3}
            >
              {tf.label}
            </Button>
          ))}
        </HStack>
      </HStack>

      <HStack spacing={4} fontSize="11px" color="#8b949e" flexWrap="wrap" mb={2}>
        <Text>Running since <Box as="span" color="#e6edf3" fontWeight="500">{fmtDate(firstDate, { withYear: true })}</Box> ({lifespanDays} days)</Text>
        <Text><Box as="span" color="#e6edf3">{activeDays}</Box> days with activity</Text>
        <Text color={daysSinceLast <= 1 ? '#3fb950' : daysSinceLast <= 7 ? '#d29922' : '#f0883e'}>
          Last active day: {fmtDate(lastDate)}{daysSinceLast > 0 ? ` (${daysSinceLast}d ago)` : ' (today)'}
        </Text>
        <Text>Total compute: <Box as="span" color="#e6edf3">{totals?.computeSpendTon?.toFixed(1) || '0'} TON</Box></Text>
      </HStack>

      <Box position="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          style={{ display: 'block', cursor: 'crosshair' }}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="#30363d" strokeWidth="0.5" />
          <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={W - PAD_R} y2={PAD_T + PLOT_H} stroke="#30363d" strokeWidth="0.5" />

          {/* y-axis labels */}
          <text x={PAD_L - 4} y={PAD_T + 4} fontSize="9" fill="#7d8590" textAnchor="end">{fmtTon(maxSpend)} TON</text>
          <text x={PAD_L - 4} y={PAD_T + PLOT_H / 2 + 3} fontSize="9" fill="#7d8590" textAnchor="end">{fmtTon(maxSpend / 2)}</text>
          <text x={PAD_L - 4} y={PAD_T + PLOT_H} fontSize="9" fill="#7d8590" textAnchor="end">0</text>

          {/* month tick marks */}
          {ticks.map(i => {
            const x = PAD_L + i * barStep;
            return (
              <g key={`tick-${i}`}>
                <line x1={x} y1={PAD_T + PLOT_H} x2={x} y2={PAD_T + PLOT_H + 4} stroke="#484f58" strokeWidth="0.5" />
                <text x={x} y={PAD_T + PLOT_H + 14} fontSize="9" fill="#7d8590" textAnchor="middle">
                  {fmtDate(visible[i].date)}
                </text>
              </g>
            );
          })}

          {/* bars */}
          {visible.map((d, i) => {
            const h = (d.computeSpendTon / maxSpend) * PLOT_H;
            const x = PAD_L + i * barStep;
            const y = PAD_T + PLOT_H - h;
            const isActive = d.computeSpendTon > 0;
            const isHover = i === hoverIdx;
            return (
              <rect
                key={d.date}
                x={x}
                y={isActive ? y : PAD_T + PLOT_H - 1}
                width={barW}
                height={isActive ? Math.max(h, 1) : 1}
                fill={isActive ? (isHover ? '#58d468' : '#3fb950') : '#21262d'}
                opacity={isActive ? (isHover ? 1 : 0.85) : 0.5}
              />
            );
          })}

          {/* hover highlight (vertical guide line) */}
          {hoverIdx !== null && (
            <line
              x1={PAD_L + hoverIdx * barStep + barW / 2}
              y1={PAD_T}
              x2={PAD_L + hoverIdx * barStep + barW / 2}
              y2={PAD_T + PLOT_H}
              stroke="#58a6ff"
              strokeWidth="0.5"
              strokeDasharray="2 2"
              opacity="0.6"
            />
          )}

          {/* last-date indicator */}
          <line
            x1={PAD_L + (visible.length - 1) * barStep + barW / 2}
            y1={PAD_T}
            x2={PAD_L + (visible.length - 1) * barStep + barW / 2}
            y2={PAD_T + PLOT_H}
            stroke="#d29922"
            strokeWidth="0.5"
            strokeDasharray="1 3"
            opacity="0.35"
          />
        </svg>

        {/* hover tooltip */}
        {hovered && (
          <Box
            position="absolute"
            top="8px"
            left={`${hoverXpct > 50 ? 0 : Math.min(100 - 24, hoverXpct + 2)}%`}
            right={hoverXpct > 50 ? `${Math.min(100 - 24, 100 - hoverXpct + 2)}%` : 'auto'}
            bg="#0d1117"
            border="1px solid #30363d"
            borderRadius="8px"
            p={3}
            fontSize="11px"
            color="#c9d1d9"
            minW="180px"
            maxW="240px"
            boxShadow="0 4px 16px rgba(0,0,0,0.4)"
            pointerEvents="none"
          >
            <Text color="#f0f6fc" fontWeight="600" mb={1} fontFamily="mono" fontSize="12px">
              {fmtDate(hovered.date, { withYear: true })}
            </Text>
            <HStack justify="space-between" spacing={4}>
              <Text color="#8b949e">Compute spend</Text>
              <Text color="#3fb950" fontWeight="500" fontFamily="mono">{hovered.computeSpendTon.toFixed(2)} TON</Text>
            </HStack>
            <HStack justify="space-between" spacing={4}>
              <Text color="#8b949e">Worker revenue</Text>
              <Text color="#58a6ff" fontWeight="500" fontFamily="mono">{hovered.workerRevenueTon.toFixed(2)} TON</Text>
            </HStack>
            <HStack justify="space-between" spacing={4}>
              <Text color="#8b949e">Commission</Text>
              <Text color="#d29922" fontWeight="500" fontFamily="mono">
                {Math.max(0, hovered.computeSpendTon - hovered.workerRevenueTon).toFixed(2)} TON
              </Text>
            </HStack>
            <HStack justify="space-between" spacing={4}>
              <Text color="#8b949e">Transactions</Text>
              <Text color="#e6edf3" fontWeight="500" fontFamily="mono">{hovered.computeTxs}</Text>
            </HStack>
            <HStack justify="space-between" spacing={4}>
              <Text color="#8b949e">Tokens (~3x mix)</Text>
              <Text color="#a371f7" fontWeight="500" fontFamily="mono">{fmtNum(hovered.tokensMix)}</Text>
            </HStack>
          </Box>
        )}
      </Box>

      {daysSinceLast >= 2 && (
        <Text fontSize="11px" color="#d29922" mt={2}>
          ⚠ Last compute activity was {daysSinceLast} days ago — network may be paused.
        </Text>
      )}
    </Box>
  );
}
