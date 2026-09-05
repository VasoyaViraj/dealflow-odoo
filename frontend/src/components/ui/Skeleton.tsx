export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-canvas border border-hairline rounded-md overflow-hidden animate-pulse">
      <div className="w-full flex border-b border-hairline bg-soft px-5 py-3 gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 bg-line-strong rounded w-24" />
        ))}
      </div>
      <div className="flex flex-col">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex border-b border-hairline px-5 py-4 gap-4 last:border-0">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <div 
                key={colIdx} 
                className={`h-4 bg-soft rounded ${colIdx === 0 ? 'w-1/3' : colIdx === columns - 1 ? 'w-1/4' : 'w-1/5'}`} 
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
