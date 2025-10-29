import React, { useState } from 'react';
import { useRoute } from '../../routes/router';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { AiGenerationBadge } from '../ai/AiGenerationBadge';
import { useAiRuntimeState, selectAiBannerMessage, selectIsAiFrozen } from '../../state/ai';

type AppShellProps = {
  children: React.ReactNode;
  pageTitle?: string;
  showAiBadge?: boolean;
  enableAiFreezeOverlay?: boolean;
};

export default function AppShell({
  children,
  pageTitle,
  showAiBadge,
  enableAiFreezeOverlay
}: AppShellProps) {
  const { path } = useRoute();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isFrozen = useAiRuntimeState(selectIsAiFrozen);
  const overlayMessage = useAiRuntimeState(selectAiBannerMessage);

  return (
    <div className="app-shell">
      <Sidebar
        currentPath={path}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="app-shell__main">
        <Topbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <div className="app-shell__content">
          {pageTitle || showAiBadge ? (
            <div className="page-header">
              {pageTitle ? <h1 className="page-title">{pageTitle}</h1> : null}
              {showAiBadge ? <AiGenerationBadge /> : null}
            </div>
          ) : null}
          {children}
          {enableAiFreezeOverlay && isFrozen ? (
            <div className="ai-freeze-overlay">
              <div className="ai-freeze-overlay__content">
                <span className="ai-status-indicator" aria-hidden="true" />
                <p>{overlayMessage}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
