import { AlertCircle } from 'lucide-react';

export default function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded p-3.5 flex items-center gap-2 max-w-2xl mx-auto my-6">
      <AlertCircle size={15} className="text-rose-600 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
