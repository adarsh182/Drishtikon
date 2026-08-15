export default function LoadingState({ message = 'Loading data...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-xs text-slate-500">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
        <span>{message}</span>
      </div>
    </div>
  );
}
