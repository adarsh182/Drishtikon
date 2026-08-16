import { AlertCircle } from 'lucide-react';

export default function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded p-4 flex flex-col gap-3 max-w-2xl mx-auto my-6">
      <div className="flex items-center gap-2">
        <AlertCircle size={15} className="text-rose-600 shrink-0" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <div className="ml-6">
          <button
            onClick={onRetry}
            className="bg-white border border-rose-300 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded transition-colors font-medium text-[11px] shadow-sm"
          >
            Retry Request
          </button>
        </div>
      )}
    </div>
  );
}
