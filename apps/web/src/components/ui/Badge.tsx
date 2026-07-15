import React from 'react';
import { clsx } from 'clsx';

type BadgeVariant =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'approve'
  | 'reject'
  | 'review'
  | 'stable'
  | 'warning'
  | 'drifted'
  | 'default';

const variantStyles: Record<BadgeVariant, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  approve: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  reject: 'bg-red-500/20 text-red-400 border-red-500/30',
  review: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  stable: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  drifted: 'bg-red-500/20 text-red-400 border-red-500/30',
  default: 'bg-white/10 text-slate-300 border-white/10',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  children,
  className,
  dot = false,
}) => {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border tracking-wide uppercase',
        variantStyles[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', {
            'bg-red-400': variant === 'critical' || variant === 'reject' || variant === 'drifted',
            'bg-orange-400': variant === 'high',
            'bg-yellow-400': variant === 'medium' || variant === 'warning',
            'bg-blue-400': variant === 'low',
            'bg-emerald-400': variant === 'approve' || variant === 'stable',
            'bg-amber-400': variant === 'review',
            'bg-slate-400': variant === 'default',
          })}
        />
      )}
      {children}
    </span>
  );
};
