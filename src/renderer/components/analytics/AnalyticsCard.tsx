import React from 'react';

type AnalyticsCardProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
};

export default function AnalyticsCard({ title, children, className = '', actions }: AnalyticsCardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--surface-card)',
        borderRadius: 20,
        padding: 24,
        boxShadow: '0 16px 40px rgba(15, 23, 42, 0.08)',
        border: '1px solid var(--surface-border)'
      }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 20 
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: 18, 
          fontWeight: 600,
          color: 'var(--text-primary)'
        }}>
          {title}
        </h3>
        {actions}
      </div>
      {children}
    </div>
  );
}
