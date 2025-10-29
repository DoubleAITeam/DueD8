import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type Route = {
  path: string;
  element: React.ReactNode;
};

type RouterContextValue = {
  path: string;
  navigate: (to: string) => void;
};

const RouterContext = React.createContext<RouterContextValue | null>(null);
let routerMounted = false;

function normalisePath(path: string) {
  if (!path) return '/';
  const trimmed = path.startsWith('/') ? path : `/${path}`;
  if (trimmed.length > 1 && trimmed.endsWith('/')) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}

function hashToPath(hash: string) {
  if (!hash) return '/';
  return normalisePath(hash.replace(/^#/, ''));
}

function pathToHash(path: string) {
  const normalised = normalisePath(path);
  return `#${normalised}`;
}

function matchPath(current: string, candidate: string) {
  if (candidate === '*') return true;
  return normalisePath(current) === normalisePath(candidate);
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState(() => hashToPath(window.location.hash));
  const initialisedRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      if (routerMounted) {
        throw new Error(
          'RouterProvider mounted more than once. Ensure it wraps the application a single time.'
        );
      }
      routerMounted = true;
      return () => {
        routerMounted = false;
      };
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = '#/';
      setPath('/');
    } else if (!initialisedRef.current) {
      const currentPath = hashToPath(window.location.hash);
      const normalisedHash = pathToHash(currentPath);
      if (window.location.hash !== normalisedHash) {
        window.location.hash = normalisedHash;
      }
      setPath(currentPath);
    }
    initialisedRef.current = true;
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setPath(hashToPath(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((to: string) => {
    const nextHash = pathToHash(to);
    if (window.location.hash === nextHash) return;
    window.location.hash = nextHash;
  }, []);

  const value = useMemo<RouterContextValue>(() => ({ path, navigate }), [path, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function RouterView({ routes }: { routes: Route[] }) {
  const { path } = useRoute();

  const activeRoute = useMemo(() => {
    for (const route of routes) {
      if (matchPath(path, route.path)) {
        return route;
      }
    }
    return routes.find((route) => route.path === '*') ?? null;
  }, [path, routes]);

  return <>{activeRoute ? activeRoute.element : null}</>;
}

function throwContextError(hookName: string): never {
  const baseMessage = `${hookName} must be used within a <RouterProvider>.`;

  if (process.env.NODE_ENV !== 'production') {
    const error = new Error(baseMessage);
    if (error.stack) {
      const stackLines = error.stack
        .split('\n')
        .slice(1, 4)
        .map((line) => line.trim())
        .join('\n');
      error.message = `${baseMessage}\n\nHook called outside router context.\n${stackLines}`;
    }
    throw error;
  }

  throw new Error(baseMessage);
}

export function useRoute() {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throwContextError('useRoute');
  }
  return ctx;
}

export function useNavigate() {
  return useRoute().navigate;
}

export function useNavigateOptional() {
  const ctx = useContext(RouterContext);
  return ctx?.navigate ?? null;
}

export function Link(
  props: React.PropsWithChildren<{
    to: string;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  }>
) {
  const navigate = useNavigate();
  return (
    <a
      href={pathToHash(props.to)}
      className={props.className}
      onClick={(event) => {
        event.preventDefault();
        props.onClick?.(event);
        navigate(props.to);
      }}
    >
      {props.children}
    </a>
  );
}

export function Navigate({ to }: { to: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to);
  }, [navigate, to]);
  return null;
}
