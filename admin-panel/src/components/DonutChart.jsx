export default function DonutChart({ data }) {
  if (!data || data.length === 0) return null;

  const totalVal = data.reduce((acc, curr) => acc + curr.val, 0) || 1;
  const colors = ['#6366f1', '#10b981', '#38bdf8', '#fbbf24', '#ec4899'];

  let accumulatedPercentage = 0;
  const segments = data.map((d, index) => {
    const percent = (d.val / totalVal) * 100;
    const startAngle = accumulatedPercentage;
    accumulatedPercentage += percent;
    return {
      ...d,
      percent,
      color: colors[index % colors.length]
    };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
      <div style={{ width: '160px', height: '160px', position: 'relative' }}>
        <svg width="100%" height="100%" viewBox="0 0 42 42" className="donut" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
          {segments.map((seg, idx) => {
            const strokeDasharray = `${seg.percent} ${100 - seg.percent}`;
            const strokeDashoffset = 100 - segments.slice(0, idx).reduce((acc, curr) => acc + curr.percent, 0) + 25;
            return (
              <circle
                key={idx}
                cx="21"
                cy="21"
                r="15.915"
                fill="transparent"
                stroke={seg.color}
                strokeWidth="4.5"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.3s ease' }}
              />
            );
          })}
        </svg>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', pointerEvents: 'none'
        }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>100%</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Volume</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: '150px', overflow: 'hidden' }}>
        {segments.map((seg, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={seg.group_key}>
                {seg.group_key}
              </span>
            </div>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>{seg.percent.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
