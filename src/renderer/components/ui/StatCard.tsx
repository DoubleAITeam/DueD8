import React from 'react';

type StatCardProps = {
  title: string;
  value: string;
  hint?: string;
  children?: React.ReactNode;
};

export default function StatCard({ title, value, hint, children }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card__header">
        <p className="stat-card__title">{title}</p>
        <p className="stat-card__value">{value}</p>
        {hint ? <p className="stat-card__hint">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
