import React from 'react';
import {
  NavLink,
  Route,
  Routes,
  matchPath,
  useLocation,
  useNavigate
} from 'react-router-dom';
import Dashboard from '../../pages/Dashboard';
import ClassPage from '../../pages/Class';
import AssignmentPage from '../../pages/Assignment';
import { useUIStore } from '../../state/uiStore';
import { binderReducer, initialBinderState } from '../../state/binderReducer';
import { BinderRail } from './BinderRail';
import { Breadcrumb, Crumb } from './Breadcrumb';
import { BinderNode } from '../../types/binder';
import { getAllClasses, getAssignmentById, getClassById } from '../../data/classes';
import { useMediaQuery } from '../../hooks/useMediaQuery';

function classNames(base: string, active: boolean) {
  return active ? `${base} ${base}--active` : base;
}

function BinderTopBar() {
  const chatOpen = useUIStore((state) => state.chatOpen);
  const unreadCount = useUIStore((state) => state.unreadCount);
  const openChat = useUIStore((state) => state.openChat);
  const minimizeChat = useUIStore((state) => state.minimizeChat);
  const clearUnread = useUIStore((state) => state.clearUnread);
  const classes = React.useMemo(() => getAllClasses(), []);

  const toggleChat = () => {
    if (chatOpen) {
      minimizeChat();
    } else {
      openChat();
      clearUnread();
    }
  };

  return (
    <header className="topbar">
      <div className="topbar__left">
        <span className="topbar__brand">DueD8</span>
        <nav className="topbar__nav" aria-label="Primary navigation">
          <NavLink
            to="/"
            className={({ isActive }) =>
              classNames('topbar__link', isActive)
            }
            end
          >
            Dashboard
          </NavLink>
          {classes.map((course) => (
            <NavLink
              key={course.id}
              to={`/class/${course.id}`}
              className={({ isActive }) =>
                classNames('topbar__link', isActive)
              }
            >
              {course.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <button
        type="button"
        className={chatOpen ? 'topbar__assistant topbar__assistant--active' : 'topbar__assistant'}
        onClick={toggleChat}
      >
        {chatOpen ? 'Hide Assistant' : 'Open Assistant'}
        {!chatOpen && unreadCount > 0 ? <span className="topbar__badge">{unreadCount}</span> : null}
      </button>
    </header>
  );
}

function resolveHref(node: BinderNode): string {
  switch (node.type) {
    case 'main':
      return '/';
    case 'class':
      return `/class/${node.id}`;
    case 'assignment':
      return `/class/${node.parentClassId}/assignment/${node.id}`;
    default:
      return '/';
  }
}

function buildBreadcrumb(stateNodes: BinderNode[], activeId: string): Crumb[] {
  const activeNode = stateNodes.find((node) => node.id === activeId);
  if (!activeNode) {
    return [];
  }

  if (activeNode.type === 'main') {
    return [{ id: activeNode.id, label: activeNode.label, href: resolveHref(activeNode), current: true }];
  }

  if (activeNode.type === 'class') {
    return [
      { id: 'dashboard', label: 'Dashboard', href: '/' },
      { id: activeNode.id, label: activeNode.label, href: resolveHref(activeNode), current: true }
    ];
  }

  const parentClass = stateNodes.find(
    (node): node is Extract<BinderNode, { type: 'class' }> =>
      node.type === 'class' && node.id === activeNode.parentClassId
  );

  const classCrumb = parentClass
    ? { id: parentClass.id, label: parentClass.label, href: resolveHref(parentClass) }
    : {
        id: activeNode.parentClassId,
        label: activeNode.parentClassId,
        href: `/class/${activeNode.parentClassId}`
      };

  return [
    { id: 'dashboard', label: 'Dashboard', href: '/' },
    classCrumb,
    {
      id: activeNode.id,
      label: activeNode.label,
      href: resolveHref(activeNode),
      current: true
    }
  ];
}

function useBinderTelemetry() {
  return React.useCallback((event: string, payload: Record<string, unknown>) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info(`[telemetry] ${event}`, payload);
    }
  }, []);
}

export function BinderAppShell() {
  const [state, dispatch] = React.useReducer(binderReducer, initialBinderState);
  const location = useLocation();
  const navigate = useNavigate();
  const track = useBinderTelemetry();
  const isCompact = useMediaQuery('(max-width: 1024px)');
  const nodesRef = React.useRef(state.nodes);

  React.useEffect(() => {
    nodesRef.current = state.nodes;
  }, [state.nodes]);

  React.useEffect(() => {
    const assignmentMatch = matchPath('/class/:classId/assignment/:assignmentId', location.pathname);
    if (assignmentMatch) {
      const { classId, assignmentId } = assignmentMatch.params;
      const classData = getClassById(classId);
      if (classData) {
        dispatch({
          type: 'OPEN_CLASS',
          node: { type: 'class', id: classData.id, label: classData.label, color: classData.color }
        });
        const assignmentData = getAssignmentById(classId, assignmentId);
        if (assignmentData) {
          const existed = nodesRef.current.some((node) => node.id === assignmentData.id);
          dispatch({
            type: 'OPEN_ASSIGNMENT',
            node: {
              type: 'assignment',
              id: assignmentData.id,
              label: assignmentData.label,
              color: assignmentData.color,
              parentClassId: classData.id
            }
          });
          dispatch({ type: 'ACTIVATE', id: assignmentData.id });
          if (!existed) {
            track('ui.binder.tab_open', { type: 'assignment', id: assignmentData.id });
          }
          return;
        }
        dispatch({ type: 'ACTIVATE', id: classData.id });
        return;
      }
      dispatch({ type: 'OPEN_MAIN' });
      dispatch({ type: 'ACTIVATE', id: 'dashboard' });
      return;
    }

    const classMatch = matchPath('/class/:classId', location.pathname);
    if (classMatch) {
      const { classId } = classMatch.params;
      const classData = getClassById(classId);
      if (classData) {
        const existed = nodesRef.current.some((node) => node.id === classData.id);
        dispatch({
          type: 'OPEN_CLASS',
          node: { type: 'class', id: classData.id, label: classData.label, color: classData.color }
        });
        dispatch({ type: 'ACTIVATE', id: classData.id });
        if (!existed) {
          track('ui.binder.tab_open', { type: 'class', id: classData.id });
        }
        return;
      }
    }

    dispatch({ type: 'OPEN_MAIN' });
    dispatch({ type: 'ACTIVATE', id: 'dashboard' });
  }, [location.pathname, track]);

  const handleActivate = React.useCallback(
    (id: string) => {
      const node = state.nodes.find((item) => item.id === id);
      if (!node) {
        return;
      }

      dispatch({ type: 'ACTIVATE', id });
      track('ui.binder.tab_activate', { id });
      navigate(resolveHref(node));
    },
    [navigate, state.nodes, track]
  );

  const handleClose = React.useCallback(
    (id: string) => {
      const index = state.nodes.findIndex((node) => node.id === id);
      if (index <= 0) {
        return;
      }

      const remaining = state.nodes.slice(0, index);
      const nextActive = remaining[remaining.length - 1];
      const cascadeCount = state.nodes.length - index;

      dispatch({ type: 'CLOSE', id });
      track('ui.binder.tab_close', { id, cascadeCount });

      if (nextActive) {
        navigate(resolveHref(nextActive));
      } else {
        navigate('/');
      }
    },
    [navigate, state.nodes, track]
  );

  const handleOverflowScroll = React.useCallback(
    (direction: 'left' | 'right') => {
      track('ui.binder.overflow_scroll', { direction });
    },
    [track]
  );

  const breadcrumbItems = React.useMemo(
    () => buildBreadcrumb(state.nodes, state.activeId),
    [state.nodes, state.activeId]
  );

  return (
    <div className="app">
      <BinderTopBar />
      <div className="main">
        <BinderRail
          nodes={state.nodes}
          activeId={state.activeId}
          onActivate={handleActivate}
          onClose={handleClose}
          compact={isCompact}
          onOverflowScroll={handleOverflowScroll}
        />
        <div className="content-pane">
          <Breadcrumb items={breadcrumbItems} />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/class/:classId" element={<ClassPage />} />
            <Route path="/class/:classId/assignment/:assignmentId" element={<AssignmentPage />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
