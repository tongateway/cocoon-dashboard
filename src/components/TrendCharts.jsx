import { useMemo, useRef, useState } from 'react';
import { Box, HStack, Text } from '@chakra-ui/react';
import { WINDOWS } from './WindowToggle';
import { inWindow } from '../lib/rateMath';

function bucket(txs, windowMs, bucketCount, valueFn) {
  const now = Date.now();
  const step = windowMs / bucketCount;
  const out = new Array(bucketCount).fill(0);
  for (const tx of txs) {
    const age = now - (tx.utime || 0) * 1000;
    if (age < 0 || age >= windowMs) continue;
    const idx = bucketCount - 1 - Math.floor(age / step);
    if (idx >= 0 && idx < bucketCount) out[idx] += valueFn(tx);
  }
  return out;
}

const W = 900, H = 280;
const PAD = { l: 42, r: 16, t: 16, b: 28 };
const innerW = W - PAD.l - PAD.r;
const innerH = H - PAD.t - PAD.b;

export default function TrendCharts({ bufferRef, bufferVersion, window: windowId, computeMetrics }) {
  const wopt = WINDOWS.find(x => x.id === windowId) || WINDOWS[0];
  const windowMs = isFinite(wopt.ms) ? wopt.ms : 30 * 24 * 60 * 60 * 1000;
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(null);

  const { spendSeries, revSeries, tickFormatter, tickCount, rangeLabel } = useMemo(() => {
    const isAll = windowId === 'all';
    const dailySeries = isAll ? (computeMetrics?.daily || []) : [];

    let spendSeries, revSeries, tickCount = 6, tickFormatter, rangeLabel;

    if (isAll && dailySeries.length > 0) {
      spendSeries = dailySeries.map(d => d.computeSpendTon || 0);
      revSeries = dailySeries.map(d => d.workerRevenueTon || 0);
      rangeLabel = 'all time';
      tickFormatter = (i) => dailySeries[i]?.date?.slice(5) || '';
    } else {
      const allTxs = bufferRef.items();
      const windowTxs = inWindow(allTxs, windowMs);
      const buckets = windowId === '1h' ? 30 : windowId === '24h' ? 24 : windowId === '7d' ? 7 * 24 : 30;
      spendSeries = bucket(windowTxs, windowMs, buckets, tx =>
        (tx.contractRole === 'cocoon_proxy' && tx._op === 'client_proxy_request') ||
        (tx.contractRole === 'cocoon_client' && tx._op === 'ext_client_charge_signed')
          ? parseInt(tx.in_msg?.value || '0', 10) / 1e9 : 0);
      revSeries = bucket(windowTxs, windowMs, buckets, tx =>
        tx.contractRole === 'cocoon_worker' && tx._op === 'ext_worker_payout_signed'
          ? parseInt(tx.in_msg?.value || '0', 10) / 1e9 : 0);
      if (windowId === '1h') {
        rangeLabel = 'last hour';
        tickFormatter = (i, n) => `${Math.round((i / (n - 1)) * 60)}m`;
      } else if (windowId === '24h') {
        rangeLabel = 'last 24 hours';
        tickCount = 6;
        tickFormatter = (i, n) => `${String(Math.floor((i / (n - 1)) * 24)).padStart(2, '0')}:00`;
      } else if (windowId === '7d') {
        rangeLabel = 'last 7 days';
        tickCount = 7;
        tickFormatter = (i, n) => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][Math.min(6, Math.floor((i / (n - 1)) * 7))];
      }
    }

    return { spendSeries, revSeries, tickFormatter, tickCount, rangeLabel };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowId, bufferVersion, computeMetrics]);

  const spendMax = Math.max(1e-6, ...spendSeries) * 1.08;
  const revMax = Math.max(1e-6, ...revSeries) * 1.15;
  const n = spendSeries.length;

  const xAt = (i) => PAD.l + (i / (n - 1 || 1)) * innerW;
  const ySpend = (v) => PAD.t + innerH - (v / spendMax) * innerH;
  const yRev = (v) => PAD.t + innerH - (v / revMax) * innerH;

  // Grid lines (horizontal y-axis ticks)
  const gridY = 4;
  const gridLines = [];
  for (let i = 0; i <= gridY; i++) {
    const y = PAD.t + (i / gridY) * innerH;
    const val = spendMax * (1 - i / gridY);
    gridLines.push(
      <g key={`gy-${i}`}>
        <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y}
              stroke="var(--line-soft)" strokeWidth="1" shapeRendering="crispEdges" />
        <text x={PAD.l - 8} y={y + 3} textAnchor="end"
              fill="var(--fg-3)" fontSize="10" fontFamily="var(--ff-mono)">
          {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val < 1 ? val.toFixed(2) : val.toFixed(1)}
        </text>
      </g>
    );
  }

  // X ticks
  const xTicks = [];
  for (let i = 0; i < tickCount; i++) {
    const idx = Math.round((i / (tickCount - 1)) * (n - 1));
    const x = xAt(idx);
    xTicks.push(
      <text key={`xt-${i}`} x={x} y={H - 8} textAnchor="middle"
            fill="var(--fg-3)" fontSize="10" fontFamily="var(--ff-mono)">
        {tickFormatter ? tickFormatter(idx, n) : ''}
      </text>
    );
  }

  // Area path for spend (primary)
  const spendPts = spendSeries.map((v, i) => `${xAt(i).toFixed(1)},${ySpend(v).toFixed(1)}`);
  const spendLine = 'M' + spendPts.join(' L');
  const spendArea = `${spendLine} L${xAt(n - 1).toFixed(1)},${PAD.t + innerH} L${xAt(0).toFixed(1)},${PAD.t + innerH} Z`;

  // Secondary line (worker revenue, dashed like design's p95 latency line)
  const revPts = revSeries.map((v, i) => `${xAt(i).toFixed(1)},${yRev(v).toFixed(1)}`);
  const revLine = 'M' + revPts.join(' L');

  // Averages for legend
  const avgSpend = spendSeries.reduce((a, b) => a + b, 0) / n;
  const avgRev = revSeries.reduce((a, b) => a + b, 0) / n;

  // Hover handler
  const handleMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xSvg = ((e.clientX - rect.left) / rect.width) * W;
    if (xSvg < PAD.l || xSvg > W - PAD.r) { setHoverIdx(null); return; }
    const idx = Math.round(((xSvg - PAD.l) / innerW) * (n - 1));
    setHoverIdx(Math.max(0, Math.min(n - 1, idx)));
  };

  const hoverVals = hoverIdx != null ? { spend: spendSeries[hoverIdx], rev: revSeries[hoverIdx] } : null;
  const hoverX = hoverIdx != null ? xAt(hoverIdx) : 0;
  const tooltipPct = hoverIdx != null ? (hoverX / W) * 100 : 0;

  return (
    <Box id="metrics"
      sx={{
        background: 'var(--bg-1)',
        border: '1px solid var(--line-soft)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '20px',
        overflow: 'hidden',
      }}
    >
      {/* Section head */}
      <Box sx={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--line-soft)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <Box>
          <Text fontSize="13px" fontWeight="600" letterSpacing="-0.005em" color="var(--fg-0)">
            Network throughput
          </Text>
          <Text fontSize="12px" color="var(--fg-2)" mt="2px">
            Compute spend + worker payouts · {rangeLabel || wopt.label}
          </Text>
        </Box>
        <Box flex={1} />
        <HStack spacing="14px" fontSize="11.5px" color="var(--fg-1)">
          <HStack spacing="6px">
            <Box w="8px" h="8px" borderRadius="2px" bg="var(--accent)" />
            <Text>Compute</Text>
            <Text className="mono" color="var(--fg-0)">{avgSpend < 1 ? avgSpend.toFixed(3) : avgSpend.toFixed(2)} TON avg</Text>
          </HStack>
          <HStack spacing="6px">
            <Box w="8px" h="2px" bg="var(--info)" />
            <Text>Payouts</Text>
            <Text className="mono" color="var(--fg-0)">{avgRev < 1 ? avgRev.toFixed(3) : avgRev.toFixed(2)} TON avg</Text>
          </HStack>
        </HStack>
      </Box>

      <Box
        ref={wrapRef}
        sx={{ padding: '8px 16px 16px', position: 'relative' }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '280px', display: 'block' }}
        >
          <defs>
            <linearGradient id="gAreaSpend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(85% 0.18 135)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="oklch(85% 0.18 135)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridLines}
          {xTicks}

          <path d={spendArea} fill="url(#gAreaSpend)" />
          <path d={spendLine} stroke="var(--accent)" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
          <path d={revLine} stroke="var(--info)" strokeWidth="1.5" fill="none" strokeDasharray="3 3" strokeLinejoin="round" />

          {hoverIdx != null && (
            <g>
              <line x1={hoverX} x2={hoverX} y1={PAD.t} y2={PAD.t + innerH}
                    stroke="var(--fg-2)" strokeWidth="1" strokeDasharray="2 3" />
              <circle cx={hoverX} cy={ySpend(hoverVals.spend)} r="4"
                      fill="var(--bg-0)" stroke="var(--accent)" strokeWidth="2" />
              <circle cx={hoverX} cy={yRev(hoverVals.rev)} r="3.5"
                      fill="var(--bg-0)" stroke="var(--info)" strokeWidth="2" />
            </g>
          )}
        </svg>

        {hoverIdx != null && (
          <Box
            sx={{
              position: 'absolute',
              left: `${tooltipPct}%`,
              top: `${(ySpend(hoverVals.spend) / H) * 100}%`,
              transform: `translate(${tooltipPct > 70 ? 'calc(-100% - 12px)' : '12px'}, -100%)`,
              marginTop: '-10px',
              background: 'var(--bg-2)',
              border: '1px solid var(--line)',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '11.5px',
              color: 'var(--fg-0)',
              pointerEvents: 'none',
              minWidth: '180px',
              boxShadow: '0 8px 20px -4px rgba(0,0,0,0.4)',
              zIndex: 5,
            }}
          >
            <Text className="mono" fontSize="10.5px" color="var(--fg-2)" mb="4px">
              {tickFormatter ? tickFormatter(hoverIdx, n) : ''}
            </Text>
            <HStack justify="space-between" py="2px">
              <HStack spacing="6px" color="var(--fg-1)">
                <Box w="8px" h="8px" borderRadius="2px" bg="var(--accent)" />
                <Text>Compute</Text>
              </HStack>
              <Text className="mono" fontWeight="500">
                {hoverVals.spend < 1 ? hoverVals.spend.toFixed(4) : hoverVals.spend.toFixed(2)} TON
              </Text>
            </HStack>
            <HStack justify="space-between" py="2px">
              <HStack spacing="6px" color="var(--fg-1)">
                <Box w="8px" h="2px" bg="var(--info)" />
                <Text>Payouts</Text>
              </HStack>
              <Text className="mono" fontWeight="500">
                {hoverVals.rev < 1 ? hoverVals.rev.toFixed(4) : hoverVals.rev.toFixed(2)} TON
              </Text>
            </HStack>
          </Box>
        )}
      </Box>
    </Box>
  );
}
