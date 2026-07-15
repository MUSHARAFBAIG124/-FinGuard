import React from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  color: string;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  subClassName?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  sub,
  icon: Icon,
  color,
  className = 'glass-card p-5 flex items-start gap-3',
  labelClassName = 'text-xs text-slate-400 mb-0.5',
  valueClassName = 'text-2xl font-heading font-bold text-white',
  subClassName = 'text-xs text-slate-500 mt-0.5',
}) => (
  <div className={className}>
    <div className={`p-2.5 rounded-xl border ${color}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <p className={labelClassName}>{label}</p>
      <p className={valueClassName}>{value}</p>
      <p className={subClassName}>{sub}</p>
    </div>
  </div>
);
