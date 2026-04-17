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

// SVG dims
const W = 800, H = 180;
const PAD_L = 42, PAD_R = 18, PAD_T = 14, PAD_B = 32;
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
      <Box py={8} borderTop="1px solid var(--line-faint)" borderBottom="1px solid var(--line-faint)">
        <Text fontSize="13px" color="var(--ink-mid)" fontFamily="var(--ff-display)" fontStyle="italic"
              sx={{ fontVariationSettings: '"opsz" 14, "SOFT" 80' }}>
          No historical activity yet.
        </Text>
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

  const daysSinceColor = daysSinceLast <= 1 ? 'var(--mint)' : daysSinceLast <= 7 ? 'var(--honey)' : 'var(--coral)';

  return (
    <Box className="fade-up-4">
      {/* Section head */}
      <HStack justify="space-between" align="baseline" mb={4} flexWrap="wrap" gap={3}>
        <HStack spacing={4} align="baseline" flexWrap="wrap">
          <Text fontSize="11px" fontFamily="var(--ff-mono)" letterSpacing="0.24em" textTransform="uppercase" color="var(--ink-low)">
            § IV · Lifespan
          </Text>
          <Text fontFamily="var(--ff-display)" fontStyle="italic" fontSize="16px" color="var(--ink-mid)"
                sx={{ fontVariationSettings: '"opsz" 18, "SOFT" 80' }}>
            daily compute spend since the network began
          </Text>
        </HStack>
        <HStack spacing={0} border="1px solid var(--line)" borderRadius="2px" overflow="hidden" height="28px">
          {TIMEFRAMES.map((tf, i) => {
            const active = timeframe === tf.id;
            return (
              <Box
                as="button"
                key={tf.id}
                onClick={() => { setTimeframe(tf.id); setHoverIdx(null); }}
                px={3}
                h="100%"
                display="flex"
                alignItems="center"
                justifyContent="center"
                minW="38px"
                fontFamily="var(--ff-mono)"
                fontSize="11px"
                fontWeight="500"
                color={active ? 'var(--bg-void)' : 'var(--ink-mid)'}
                bg={active ? 'var(--honey)' : 'transparent'}
                borderLeft={i === 0 ? 'none' : '1px solid var(--line-faint)'}
                _hover={{ color: active ? 'var(--bg-void)' : 'var(--ink-high)',
                          bg: active ? 'var(--honey)' : 'rgba(232, 198, 116, 0.06)' }}
                sx={{ transition: 'all 150ms var(--ease-soft)', cursor: 'pointer' }}
              >
                {tf.label}
              </Box>
            );
          })}
        </HStack>
      </HStack>

      {/* Summary strip */}
      <Box borderTop="1px solid var(--line-faint)" borderBottom="1px solid var(--line-faint)" py={5} mb={5}>
        <HStack spacing={{ base: 4, md: 10 }} flexWrap="wrap">
          <Stat label="Genesis" big={fmtDate(firstDate)} sub={`${lifespanDays} days ago`} />
          <Stat label="Days active" big={String(activeDays)} sub={`of ${filled.length} tracked`} />
          <Stat label="Last activity" big={fmtDate(lastDate)} sub={daysSinceLast > 0 ? `${daysSinceLast}d ago` : 'today'} tone={daysSinceColor} />
          <Stat label="Lifetime compute" big={`${(totals?.computeSpendTon || 0).toFixed(0)}`} unit="TON" tone="var(--honey)" />
        </HStack>
      </Box>

      {/* Chart */}
      <Box position="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          style={{ display: 'block', cursor: 'crosshair', overflow: 'visible' }}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="lsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8c674" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#e8c674" stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {/* gridlines */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--line-faint)" strokeWidth="0.5" />
          <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={W - PAD_R} y2={PAD_T + PLOT_H} stroke="var(--line-faint)" strokeWidth="0.5" />
          <line x1={PAD_L} y1={PAD_T + PLOT_H/2} x2={W - PAD_R} y2={PAD_T + PLOT_H/2} stroke="var(--line-faint)" strokeWidth="0.3" strokeDasharray="1 4" />

          {/* y-axis labels — Fraunces numerals */}
          <text x={PAD_L - 6} y={PAD_T + 4} fontSize="10" fill="var(--ink-low)" textAnchor="end"
                fontFamily="JetBrains Mono, monospace">{fmtTon(maxSpend)} TON</text>
          <text x={PAD_L - 6} y={PAD_T + PLOT_H / 2 + 3} fontSize="10" fill="var(--ink-faint)" textAnchor="end"
                fontFamily="JetBrains Mono, monospace">{fmtTon(maxSpend / 2)}</text>
          <text x={PAD_L - 6} y={PAD_T + PLOT_H + 2} fontSize="10" fill="var(--ink-faint)" textAnchor="end"
                fontFamily="JetBrains Mono, monospace">0</text>

          {/* month ticks */}
          {ticks.map(i => {
            const x = PAD_L + i * barStep;
            return (
              <g key={`tick-${i}`}>
                <line x1={x} y1={PAD_T + PLOT_H} x2={x} y2={PAD_T + PLOT_H + 4} stroke="var(--line)" strokeWidth="0.5" />
                <text x={x} y={PAD_T + PLOT_H + 18} fontSize="9.5" fill="var(--ink-low)" textAnchor="middle"
                      fontFamily="JetBrains Mono, monospace">{fmtDate(visible[i].date)}</text>
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
                fill={isActive ? (isHover ? '#ffd874' : 'url(#lsGrad)') : 'var(--line-faint)'}
                opacity={isActive ? 1 : 0.6}
                style={{ transition: 'fill 120ms var(--ease-soft)' }}
              />
            );
          })}

          {/* hover vertical guide */}
          {hoverIdx !== null && (
            <line
              x1={PAD_L + hoverIdx * barStep + barW / 2}
              y1={PAD_T}
              x2={PAD_L + hoverIdx * barStep + barW / 2}
              y2={PAD_T + PLOT_H}
              stroke="var(--ink-mid)"
              strokeWidth="0.5"
              strokeDasharray="2 2"
              opacity="0.4"
            />
          )}
        </svg>

        {/* Hover tooltip */}
        {hovered && (
          <Box
            position="absolute"
            top="16px"
            left={`${hoverXpct > 60 ? 0 : Math.min(100 - 28, hoverXpct + 3)}%`}
            right={hoverXpct > 60 ? `${Math.min(100 - 28, 100 - hoverXpct + 3)}%` : 'auto'}
            bg="rgba(7, 8, 10, 0.92)"
            backdropFilter="blur(8px)"
            border="1px solid var(--line-strong)"
            borderRadius="2px"
            p={4}
            minW="220px"
            maxW="280px"
            pointerEvents="none"
            sx={{ animation: 'fade-up .25s var(--ease-soft) both' }}
          >
            <Text
              fontFamily="var(--ff-display)"
              fontSize="16px"
              color="var(--ink-high)"
              fontWeight="400"
              mb={3}
              sx={{ fontVariationSettings: '"opsz" 20, "SOFT" 40', letterSpacing: '-0.01em' }}
            >
              {fmtDate(hovered.date, { withYear: true })}
            </Text>
            <VStack spacing={1.5} align="stretch" fontSize="12px" fontFamily="var(--ff-mono)">
              <Row k="Compute spend" v={`${hovered.computeSpendTon.toFixed(2)} TON`} tone="var(--honey)" />
              <Row k="Worker revenue" v={`${hovered.workerRevenueTon.toFixed(2)} TON`} tone="var(--mint)" />
              <Row k="Delta" v={`${(hovered.workerRevenueTon - hovered.computeSpendTon).toFixed(2)} TON`} tone="var(--ink-mid)" />
              <Row k="Transactions" v={String(hovered.computeTxs)} />
              <Row k="Tokens (mix)" v={fmtNum(hovered.tokensMix)} tone="var(--plum)" />
            </VStack>
          </Box>
        )}
      </Box>

      {daysSinceLast >= 2 && (
        <Text fontSize="12px" color="var(--coral)" mt={4} fontFamily="var(--ff-display)" fontStyle="italic"
              sx={{ fontVariationSettings: '"opsz" 14, "SOFT" 80' }}>
          ⚠ Last compute activity was {daysSinceLast} days ago — network may be paused.
        </Text>
      )}
    </Box>
  );
}

function Stat({ label, big, unit, sub, tone = 'var(--ink-high)' }) {
  return (
    <Box>
      <Text fontSize="10px" fontFamily="var(--ff-body)" letterSpacing="0.22em" textTransform="uppercase"
            color="var(--ink-low)" fontWeight="500" mb={1}>
        {label}
      </Text>
      <HStack spacing={1} align="baseline">
        <Text fontFamily="var(--ff-display)" fontSize={{ base: '22px', md: '28px' }} color={tone} fontWeight="400"
              sx={{ fontVariationSettings: '"opsz" 48, "SOFT" 30', letterSpacing: '-0.015em', lineHeight: 1 }}>
          {big}
        </Text>
        {unit && (
          <Text fontSize="12px" color="var(--ink-low)" fontFamily="var(--ff-body)">
            {unit}
          </Text>
        )}
      </HStack>
      {sub && (
        <Text fontFamily="var(--ff-display)" fontStyle="italic" fontSize="11px" color="var(--ink-low)"
              sx={{ fontVariationSettings: '"opsz" 12, "SOFT" 80' }} mt={1}>
          {sub}
        </Text>
      )}
    </Box>
  );
}

function Row({ k, v, tone = 'var(--ink-high)' }) {
  return (
    <HStack justify="space-between" spacing={5}>
      <Text color="var(--ink-low)">{k}</Text>
      <Text color={tone} fontWeight="500">{v}</Text>
    </HStack>
  );
}
