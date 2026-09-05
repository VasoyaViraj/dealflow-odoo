export function MarginBar({ pct }: { pct: number }) {
  const color = pct >= 30 ? '#10b981' : pct >= 15 ? '#f59e0b' : '#ef4444';
  const label = pct >= 30 ? 'Healthy' : pct >= 15 ? 'Slim' : 'Low';
  const labelColor = pct >= 30 ? 'text-emerald-400' : pct >= 15 ? 'text-amber-400' : 'text-red-400';
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-zinc-500">Margin</span>
        <span className={`font-bold ${labelColor}`}>{pct.toFixed(1)}% · {label}</span>
      </div>
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct * 2, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
