import React from 'react';
import AppShell from '../components/layout/AppShell';

type PlaceholderProps = {
  title: string;
  aiEnabled?: boolean;
};

export default function Placeholder({ title, aiEnabled }: PlaceholderProps) {
  return (
    <AppShell pageTitle={title} showAiBadge={Boolean(aiEnabled)} enableAiFreezeOverlay={Boolean(aiEnabled)}>
      <div className="placeholder-card">
        <h2>{title}</h2>
        <p>This area is coming soon. Check back shortly for more tools!</p>
      </div>
    </AppShell>
  );
}
