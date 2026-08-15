export function sentimentColor(s: string | undefined) {
  if (s === 'Positive') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (s === 'Negative') return 'bg-rose-50 text-rose-700 border border-rose-200';
  return 'bg-slate-100 text-slate-600 border border-slate-200';
}

export function statusColor(s: string) {
  if (s === 'IMPROVED') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (s === 'PERSISTENT') return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (s === 'EMERGING') return 'bg-blue-50 text-blue-700 border border-blue-200';
  if (s === 'WORSENED') return 'bg-rose-50 text-rose-700 border border-rose-200';
  return 'bg-slate-100 text-slate-600 border border-slate-200';
}

export function priorityColor(p: string) {
  if (p === 'High') return 'bg-rose-50 text-rose-700 border border-rose-200';
  if (p === 'Medium') return 'bg-amber-50 text-amber-700 border border-amber-200';
  return 'bg-slate-100 text-slate-600 border border-slate-200';
}

export function pct(n: number) {
  return `${n}%`;
}
