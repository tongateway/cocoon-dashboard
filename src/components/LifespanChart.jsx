import { useMemo, useState, useRef } from 'react';
import { Box, HStack, Text, VStack } from '@chakra-ui/react';

function daysBetween(a, b) { return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000); }
function fmtDate(iso, { withYear = false } = {}) {
  const d = new Date(iso);
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
  return withYear ? `${m} ${d.getUTCDate()}, ${d.getUTCFullYear()}` : `${m} ${d.getUTCDate()}`;
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
  { id: '1m',  label: '1M',  days: 30 },
  { id: '3m',  label: '3M',  days: 90 },
  { id: '6m',  label: '6M',  days: 180 },
  { id: 'all', label: 'ALL', days: Infinity },
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

const W = 900, H = 200;
const PAD = { l: 42, r: 16, t: 12, b: 28 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

export default function LifespanChart({ daily, totals }) {
  const [timeframe, setTimeframe] = useState('all');
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);

  const filled = useMemo(() => fillDaily(daily), [daily]);
  const visible = useMemo(() => sliceForTimeframe(filled, timeframe), [filled, timeframe]);

  if (!filled.length) {
    return (
      <Box sx={sectionStyle}>
        <Box sx={headStyle}>
          <Text fontSize="13px" fontWeight="600">Network lifespan</Text>
        </Box>
        <Box sx={{ padding: '20px' }}>
          <Text fontSize="12.5px" color="var(--fg-2)">No historical activity yet.</Text>
        </Box>
      </Box>
    );
  }

  const firstDate = filled[0].date;
  const lastDate = filled[filled.length - 1].date;
  const todayIso = new Date().toISOString().slice(0, 10);
  const lifespanDays = daysBetween(firstDate, todayIso);
  const daysSinceLast = daysBetween(lastDate, todayIso);
  const activeDays = daily.filter(d => d.computeTxs > 0 || d.computeSpendTon > 0).length;

  const maxSpend = Math.max(1e-6, ...visible.map(d => d.computeSpendTon));
  const barStep = PLOT_W / visible.length;
  const barW = Math.max(1, barStep - 1);
  const ticks = monthTickIndexes(visible);

  const hovered = hoverIdx !== null ? visible[hoverIdx] : null;
  const handleMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const xSvg = ((e.clientX - rect.left) / rect.width) * W;
    if (xSvg < PAD.l || xSvg > W - PAD.r) { setHoverIdx(null); return; }
    const idx = Math.floor((xSvg - PAD.l) / barStep);
    if (idx >= 0 && idx < visible.length) setHoverIdx(idx);
    else setHoverIdx(null);
  };
  const hoverXpct = hoverIdx !== null ? ((PAD.l + hoverIdx * barStep + barW / 2) / W) * 100 : 0;

  return (
    <Box id="lifespan" sx={sectionStyle}>
      <Box sx={headStyle}>
        <Box>
          <Text fontSize="13px" fontWeight="600" color="var(--fg-0)">Network lifespan</Text>
          <Text fontSize="12px" color="var(--fg-2)" mt="2px">
            Daily compute spend · {fmtDate(firstDate, { withYear: true })} → today
          </Text>
        </Box>
        <Box flex={1} />
        <Seg options={TIMEFRAMES} value={timeframe}
             onChange={v => { setTimeframe(v); setHoverIdx(null); }} />
      </Box>

      {/* Summary strip */}
      <HStack spacing="24px" px="18px" py="12px" borderBottom="1px solid var(--line-soft)"
              flexWrap="wrap" fontSize="12px">
        <Stat label="Genesis" big={fmtDate(firstDate)} sub={`${lifespanDays}d ago`} />
        <Stat label="Active days" big={String(activeDays)} sub={`of ${filled.length}`} />
        <Stat label="Last active"
              big={fmtDate(lastDate)}
              sub={daysSinceLast > 0 ? `${daysSinceLast}d ago` : 'today'}
              tone={daysSinceLast <= 1 ? 'var(--ok)' : daysSinceLast <= 7 ? 'var(--warn)' : 'var(--err)'} />
        <Stat label="Lifetime compute"
              big={`${(totals?.computeSpendTon || 0).toFixed(0)}`}
              unit="TON" tone="var(--accent)" />
      </HStack>

      <Box sx={{ padding: '8px 16px 16px', position: 'relative' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          preserveAspectRatio="none"
          style={{ display: 'block', cursor: 'crosshair' }}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="lsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(85% 0.18 135)" stopOpacity="0.85" />
              <stop offset="100%" stopColor="oklch(85% 0.18 135)" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* grid */}
          <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + PLOT_H} stroke="var(--line-soft)" strokeWidth="0.5" />
          <line x1={PAD.l} y1={PAD.t + PLOT_H} x2={W - PAD.r} y2={PAD.t + PLOT_H} stroke="var(--line-soft)" strokeWidth="0.5" />
          <line x1={PAD.l} y1={PAD.t + PLOT_H/2} x2={W - PAD.r} y2={PAD.t + PLOT_H/2}
                stroke="var(--line-soft)" strokeWidth="0.3" strokeDasharray="2 4" />

          <text x={PAD.l - 6} y={PAD.t + 4} fontSize="10" fill="var(--fg-3)" textAnchor="end" fontFamily="JetBrains Mono">{fmtTon(maxSpend)}</text>
          <text x={PAD.l - 6} y={PAD.t + PLOT_H/2 + 3} fontSize="10" fill="var(--fg-3)" textAnchor="end" fontFamily="JetBrains Mono">{fmtTon(maxSpend/2)}</text>
          <text x={PAD.l - 6} y={PAD.t + PLOT_H + 2} fontSize="10" fill="var(--fg-3)" textAnchor="end" fontFamily="JetBrains Mono">0</text>

          {ticks.map(i => {
            const x = PAD.l + i * barStep;
            return (
              <g key={`tick-${i}`}>
                <line x1={x} y1={PAD.t + PLOT_H} x2={x} y2={PAD.t + PLOT_H + 3} stroke="var(--line)" strokeWidth="0.5" />
                <text x={x} y={PAD.t + PLOT_H + 16} fontSize="9.5" fill="var(--fg-3)" textAnchor="middle" fontFamily="JetBrains Mono">
                  {fmtDate(visible[i].date)}
                </text>
              </g>
            );
          })}

          {visible.map((d, i) => {
            const h = (d.computeSpendTon / maxSpend) * PLOT_H;
            const x = PAD.l + i * barStep;
            const y = PAD.t + PLOT_H - h;
            const active = d.computeSpendTon > 0;
            const hover = i === hoverIdx;
            return (
              <rect
                key={d.date}
                x={x}
                y={active ? y : PAD.t + PLOT_H - 1}
                width={barW}
                height={active ? Math.max(h, 1) : 1}
                fill={active ? (hover ? 'oklch(90% 0.18 135)' : 'url(#lsGrad)') : 'var(--line-soft)'}
                opacity={active ? 1 : 0.5}
                style={{ transition: 'fill 100ms var(--ease)' }}
              />
            );
          })}

          {hoverIdx !== null && (
            <line
              x1={PAD.l + hoverIdx * barStep + barW / 2}
              y1={PAD.t}
              x2={PAD.l + hoverIdx * barStep + barW / 2}
              y2={PAD.t + PLOT_H}
              stroke="var(--fg-2)"
              strokeWidth="0.5"
              strokeDasharray="2 3"
              opacity="0.5"
            />
          )}
        </svg>

        {hovered && (
          <Box
            sx={{
              position: 'absolute',
              top: '8px',
              left: `${hoverXpct > 60 ? 0 : Math.min(100 - 28, hoverXpct + 2)}%`,
              right: hoverXpct > 60 ? `${Math.min(100 - 28, 100 - hoverXpct + 2)}%` : 'auto',
              background: 'var(--bg-2)',
              border: '1px solid var(--line)',
              borderRadius: '6px',
              padding: '8px 10px',
              minWidth: '200px',
              maxWidth: '240px',
              pointerEvents: 'none',
              boxShadow: '0 8px 20px -4px rgba(0,0,0,0.4)',
              fontSize: '11.5px',
            }}
          >
            <Text className="mono" fontSize="10.5px" color="var(--fg-2)" mb="4px">
              {fmtDate(hovered.date, { withYear: true })}
            </Text>
            <VStack align="stretch" spacing="2px" className="mono">
              <Row k="Compute" v={`${hovered.computeSpendTon.toFixed(2)} TON`} tone="var(--accent)" />
              <Row k="Workers" v={`${hovered.workerRevenueTon.toFixed(2)} TON`} tone="var(--info)" />
              <Row k="Txs"     v={String(hovered.computeTxs)} />
              <Row k="Tokens"  v={fmtNum(hovered.tokensMix)} />
            </VStack>
          </Box>
        )}
      </Box>

      {daysSinceLast >= 2 && (
        <Box px="18px" pb="14px">
          <HStack spacing="6px" fontSize="11.5px">
            <Box w="6px" h="6px" borderRadius="50%" bg="var(--warn)" />
            <Text color="var(--warn)">
              Last compute activity was {daysSinceLast}d ago — network may be paused.
            </Text>
          </HStack>
        </Box>
      )}
    </Box>
  );
}

const sectionStyle = {
  background: 'var(--bg-1)',
  border: '1px solid var(--line-soft)',
  borderRadius: 'var(--radius-lg)',
  marginBottom: '20px',
  overflow: 'hidden',
};
const headStyle = {
  padding: '14px 18px',
  borderBottom: '1px solid var(--line-soft)',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

function Seg({ options, value, onChange }) {
  return (
    <Box sx={{
      display: 'inline-flex', border: '1px solid var(--line)',
      borderRadius: '6px', padding: '2px', background: 'var(--bg-1)',
      height: '28px',
    }}>
      {options.map(o => {
        const active = value === o.id;
        return (
          <Box
            as="button"
            key={o.id}
            onClick={() => onChange(o.id)}
            sx={{
              background: active ? 'var(--bg-3)' : 'transparent',
              border: 0,
              color: active ? 'var(--fg-0)' : 'var(--fg-2)',
              fontSize: '11.5px',
              fontWeight: 500,
              padding: '0 10px',
              height: '100%',
              borderRadius: '4px',
              cursor: 'pointer',
              _hover: { color: 'var(--fg-0)' },
            }}
          >
            {o.label}
          </Box>
        );
      })}
    </Box>
  );
}

function Stat({ label, big, unit, sub, tone = 'var(--fg-0)' }) {
  return (
    <HStack spacing="8px" align="baseline">
      <Text fontSize="11px" color="var(--fg-2)">{label}</Text>
      <Text fontSize="13.5px" color={tone} fontWeight="500">
        {big}
        {unit && <Text as="span" fontSize="10.5px" color="var(--fg-2)" ml="2px">{unit}</Text>}
      </Text>
      {sub && <Text fontSize="11.5px" color="var(--fg-3)" className="mono">{sub}</Text>}
    </HStack>
  );
}

function Row({ k, v, tone = 'var(--fg-0)' }) {
  return (
    <HStack justify="space-between" spacing={4}>
      <Text color="var(--fg-2)">{k}</Text>
      <Text color={tone} fontWeight="500">{v}</Text>
    </HStack>
  );
}
