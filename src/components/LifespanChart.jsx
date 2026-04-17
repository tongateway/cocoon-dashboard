import { useState, useMemo, useRef } from 'react';
import { Box, HStack, Text, VStack } from '@chakra-ui/react';

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
  const out = [];
  let prev = '';
  for (let i = 0; i < filled.length; i++) {
    const m = filled[i].date.slice(0, 7);
    if (m !== prev) { out.push(i); prev = m; }
  }
  return out;
}

const W = 800, H = 160;
const PAD_L = 32, PAD_R = 12, PAD_T = 12, PAD_B = 24;
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
      <Box bg="var(--bg-elev-1)" border="1px solid var(--line-faint)" borderRadius="var(--radius)" p={4}>
        <Text fontSize="12px" color="var(--fg-dim)">No historical activity yet.</Text>
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
    if (xSvg < PAD_L || xSvg > W - PAD_R) { setHoverIdx(null); return; }
    const idx = Math.floor((xSvg - PAD_L) / barStep);
    if (idx >= 0 && idx < visible.length) setHoverIdx(idx);
    else setHoverIdx(null);
  };
  const hoverXpct = hoverIdx !== null ? ((PAD_L + hoverIdx * barStep + barW / 2) / W) * 100 : 0;

  return (
    <Box bg="var(--bg-elev-1)" border="1px solid var(--line-faint)" borderRadius="var(--radius)" p={4} className="fade-in">
      <HStack justify="space-between" align="start" mb={3} flexWrap="wrap" gap={3}>
        <Box>
          <Text fontSize="13px" fontWeight="600" color="var(--fg)">Network lifespan</Text>
          <Text fontSize="11px" color="var(--fg-dim)" mt={0.5}>
            daily compute spend since genesis
          </Text>
        </Box>
        <HStack spacing={0} border="1px solid var(--line-faint)" borderRadius="var(--radius-sm)"
                bg="var(--bg-elev-1)" p="2px">
          {TIMEFRAMES.map(tf => {
            const active = timeframe === tf.id;
            return (
              <Box as="button" key={tf.id}
                   onClick={() => { setTimeframe(tf.id); setHoverIdx(null); }}
                   px={2.5} h="24px" minW="36px" display="flex" alignItems="center" justifyContent="center"
                   fontFamily="var(--ff-mono)" fontSize="11px" fontWeight="500"
                   color={active ? 'var(--fg)' : 'var(--fg-dim)'}
                   bg={active ? 'var(--bg-elev-2)' : 'transparent'}
                   borderRadius="3px"
                   border="1px solid"
                   borderColor={active ? 'var(--line)' : 'transparent'}
                   _hover={{ color: 'var(--fg)' }}
                   sx={{ transition: 'all 120ms var(--ease)', cursor: 'pointer' }}>
                {tf.label}
              </Box>
            );
          })}
        </HStack>
      </HStack>

      {/* Summary row */}
      <HStack spacing={6} mb={3} pb={3} borderBottom="1px solid var(--line-faint)" flexWrap="wrap" fontSize="12px">
        <Stat label="Genesis" value={fmtDate(firstDate)} sub={`${lifespanDays}d ago`} />
        <Stat label="Active" value={String(activeDays)} sub={`/ ${filled.length} days`} />
        <Stat label="Last"
              value={fmtDate(lastDate)}
              sub={daysSinceLast > 0 ? `${daysSinceLast}d ago` : 'today'}
              tone={daysSinceLast <= 1 ? 'var(--ok)' : daysSinceLast <= 7 ? 'var(--warn)' : 'var(--err)'} />
        <Stat label="Compute"
              value={`${(totals?.computeSpendTon || 0).toFixed(0)}`}
              unit="TON"
              tone="var(--accent)" />
      </HStack>

      {/* Chart */}
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
          <defs>
            <linearGradient id="lsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={W - PAD_R} y2={PAD_T + PLOT_H} stroke="var(--line-faint)" strokeWidth="0.5" />
          <line x1={PAD_L} y1={PAD_T + PLOT_H/2} x2={W - PAD_R} y2={PAD_T + PLOT_H/2} stroke="var(--line-faint)" strokeWidth="0.3" strokeDasharray="2 4" />

          <text x={PAD_L - 4} y={PAD_T + 4} fontSize="9" fill="var(--fg-faint)" textAnchor="end" fontFamily="JetBrains Mono">{fmtTon(maxSpend)}</text>
          <text x={PAD_L - 4} y={PAD_T + PLOT_H/2 + 3} fontSize="9" fill="var(--fg-faint)" textAnchor="end" fontFamily="JetBrains Mono">{fmtTon(maxSpend/2)}</text>
          <text x={PAD_L - 4} y={PAD_T + PLOT_H + 2} fontSize="9" fill="var(--fg-faint)" textAnchor="end" fontFamily="JetBrains Mono">0</text>

          {ticks.map(i => {
            const x = PAD_L + i * barStep;
            return (
              <g key={`tick-${i}`}>
                <line x1={x} y1={PAD_T + PLOT_H} x2={x} y2={PAD_T + PLOT_H + 3} stroke="var(--line)" strokeWidth="0.5" />
                <text x={x} y={PAD_T + PLOT_H + 14} fontSize="9" fill="var(--fg-faint)" textAnchor="middle" fontFamily="JetBrains Mono">{fmtDate(visible[i].date)}</text>
              </g>
            );
          })}

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
                fill={isActive ? (isHover ? '#4ade80' : 'url(#lsGrad)') : 'var(--line-faint)'}
                opacity={isActive ? 1 : 0.5}
                style={{ transition: 'fill 100ms var(--ease)' }}
              />
            );
          })}

          {hoverIdx !== null && (
            <line
              x1={PAD_L + hoverIdx * barStep + barW / 2}
              y1={PAD_T}
              x2={PAD_L + hoverIdx * barStep + barW / 2}
              y2={PAD_T + PLOT_H}
              stroke="var(--fg-mid)"
              strokeWidth="0.5"
              strokeDasharray="2 2"
              opacity="0.4"
            />
          )}
        </svg>

        {hovered && (
          <Box
            position="absolute"
            top="6px"
            left={`${hoverXpct > 60 ? 0 : Math.min(100 - 28, hoverXpct + 3)}%`}
            right={hoverXpct > 60 ? `${Math.min(100 - 28, 100 - hoverXpct + 3)}%` : 'auto'}
            bg="var(--bg-elev-2)"
            border="1px solid var(--line)"
            borderRadius="var(--radius-sm)"
            p={3}
            minW="200px"
            maxW="240px"
            pointerEvents="none"
            boxShadow="0 8px 24px rgba(0,0,0,0.4)"
          >
            <Text fontSize="12px" color="var(--fg)" fontWeight="600" mb={2}>
              {fmtDate(hovered.date, { withYear: true })}
            </Text>
            <VStack spacing={1} align="stretch" fontSize="11px" fontFamily="var(--ff-mono)">
              <Row k="Compute" v={`${hovered.computeSpendTon.toFixed(2)} TON`} tone="var(--accent)" />
              <Row k="Workers" v={`${hovered.workerRevenueTon.toFixed(2)} TON`} tone="var(--info)" />
              <Row k="Txs" v={String(hovered.computeTxs)} />
              <Row k="Tokens" v={fmtNum(hovered.tokensMix)} tone="var(--violet)" />
            </VStack>
          </Box>
        )}
      </Box>

      {daysSinceLast >= 2 && (
        <HStack mt={3} spacing={2}>
          <Box w="6px" h="6px" borderRadius="50%" bg="var(--warn)" />
          <Text fontSize="11px" color="var(--warn)">
            Last compute was {daysSinceLast}d ago — network may be paused.
          </Text>
        </HStack>
      )}
    </Box>
  );
}

function Stat({ label, value, unit, sub, tone = 'var(--fg)' }) {
  return (
    <HStack spacing={2} align="baseline">
      <Text fontSize="11px" color="var(--fg-faint)">{label}</Text>
      <Text fontSize="13px" color={tone} fontWeight="500">
        {value}{unit && <Text as="span" fontSize="10px" color="var(--fg-faint)" ml={0.5}>{unit}</Text>}
      </Text>
      {sub && <Text fontSize="11px" color="var(--fg-faint)" fontFamily="var(--ff-mono)">{sub}</Text>}
    </HStack>
  );
}
function Row({ k, v, tone = 'var(--fg)' }) {
  return (
    <HStack justify="space-between" spacing={4}>
      <Text color="var(--fg-dim)">{k}</Text>
      <Text color={tone} fontWeight="500">{v}</Text>
    </HStack>
  );
}
