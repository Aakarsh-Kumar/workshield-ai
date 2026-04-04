type BarItem = {
  id: string;
  label: string;
  value: number;
  barClass: string;
  trackClass?: string;
};

export function BarList({ items }: { items: BarItem[] }) {
  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const width = `${Math.max(8, Math.round((item.value / max) * 100))}%`;
        return (
          <div key={item.id}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-slate-700">{item.label}</span>
              <span className="font-semibold text-slate-900">{item.value}</span>
            </div>
            <div className={`h-2 overflow-hidden rounded-full ${item.trackClass || 'bg-slate-100'}`}>
              <div className={`h-full rounded-full ${item.barClass}`} style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
