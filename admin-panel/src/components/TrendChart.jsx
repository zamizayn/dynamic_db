export default function TrendChart({ data }) {
  if (!data || data.length === 0) return null;

  const width = 500;
  const height = 180;
  const padding = 30;

  const maxVal = Math.max(...data.map(d => d.val)) || 1;
  const minVal = Math.min(...data.map(d => d.val)) || 0;
  const valRange = maxVal - minVal || 1;

  const points = data.map((d, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * (width - 2 * padding);
    const y = height - padding - ((d.val - minVal) / valRange) * (height - 2 * padding);
    return { x, y, label: d.group_key, val: d.val };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.0" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="50%" stopColor="var(--accent-primary)" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>

      <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.05)" />
      <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.05)" />
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />

      <path d={areaD} fill="url(#areaGrad)" />
      <path d={pathD} fill="none" stroke="url(#lineGrad)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={5} fill="var(--accent-primary)" stroke="white" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 0 4px var(--accent-primary))' }} />
          <text x={p.x} y={height - 8} fill="var(--text-secondary)" fontSize="10" textAnchor="middle" fontFamily="Inter, sans-serif">
            {p.label}
          </text>
          <text x={p.x} y={p.y - 12} fill="var(--text-primary)" fontSize="10" fontWeight="600" textAnchor="middle" fontFamily="Inter, sans-serif">
            {p.val >= 1000 ? `${(p.val / 1000).toFixed(1)}K` : p.val}
          </text>
        </g>
      ))}
    </svg>
  );
}
