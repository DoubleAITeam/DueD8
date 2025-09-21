import React from 'react';
import AppShell from '../components/layout/AppShell';

export default function Placeholder({ title }: { title: string }) {
  return (
    <AppShell pageTitle={title}>
      <div className="placeholder-card">
        <h2>{title}</h2>
        <p>This area is coming soon. Check back shortly for more tools!</p>
      </div>
    </AppShell>
  );
}
