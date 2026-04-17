// Raw-SVG sparkline. No deps. Props: values (number[]), color, height, width.
export default function Sparkline({ values = [], color = '#3fb950', height = 24, width = 100 }) {
  if (values.length < 2) {
    return <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}
