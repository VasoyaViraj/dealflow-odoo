export function MarginBar({ pct }: { pct: number }) {
  const color = pct >= 30 ? '#006400' : pct >= 15 ? '#d9a441' : '#aa2d00';
  const label = pct >= 30 ? 'Healthy' : pct >= 15 ? 'Slim' : 'Low';
  const labelColor = pct >= 30 ? 'text-success' : pct >= 15 ? 'text-warning' : 'text-coral';
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-subtle">Margin</span>
        <span className={`font-bold ${labelColor}`}>{pct.toFixed(1)}% · {label}</span>
      </div>
      <div className="w-full h-1.5 bg-soft rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct * 2, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
