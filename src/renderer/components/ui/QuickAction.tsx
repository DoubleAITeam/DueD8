import React from 'react';
import type { IconComponent } from '../icons';

type QuickActionProps = {
  icon: IconComponent;
  title: string;
  description: string;
  onClick: () => void;
};

export default function QuickAction({ icon: Icon, title, description, onClick }: QuickActionProps) {
  return (
    <button type="button" className="quick-action" onClick={onClick}>
      <div className="quick-action__icon">
        <Icon size={22} />
      </div>
      <div className="quick-action__meta">
        <span className="quick-action__title">{title}</span>
        <span className="quick-action__description">{description}</span>
      </div>
    </button>
  );
}
