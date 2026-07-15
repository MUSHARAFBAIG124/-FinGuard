import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

export const LoadingState: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex-1 flex items-center justify-center min-h-[400px] ${className}`}>
    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
  </div>
);

export const EmptyState: React.FC<{ message: string; className?: string }> = ({
  message,
  className = 'text-center py-6 text-slate-500 text-sm',
}) => <div className={className}>{message}</div>;

export const ErrorState: React.FC<{ message: string; className?: string }> = ({
  message,
  className = '',
}) => (
  <div
    className={`flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200 ${className}`}
  >
    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
    <span>{message}</span>
  </div>
);
