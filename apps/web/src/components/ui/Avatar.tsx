import React from 'react';
import { clsx } from 'clsx';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
};

// Deterministic color based on name
const colors = [
  'from-indigo-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-sky-500 to-blue-600',
  'from-violet-500 to-indigo-600',
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length] ?? colors[0]!;
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  const first = parts[0] ?? '';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? '';
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 'md', className }) => {
  return (
    <div
      className={clsx(
        'rounded-full bg-gradient-to-br flex items-center justify-center font-semibold text-white flex-shrink-0',
        getColor(name),
        sizeStyles[size],
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
};
