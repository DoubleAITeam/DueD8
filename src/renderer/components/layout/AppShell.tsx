import React, { useState } from 'react';
import { useRoute } from '../../routes/router';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

type AppShellProps = {
  children: React.ReactNode;
  pageTitle?: string;
};

export default function AppShell({ children, pageTitle }: AppShellProps) {
  const { path } = useRoute();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          {pageTitle ? <h1 className="page-title">{pageTitle}</h1> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
