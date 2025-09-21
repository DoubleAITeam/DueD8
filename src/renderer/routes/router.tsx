import React, { useEffect, useMemo, useState } from 'react';

type Route = {
  path: string;
  element: React.ReactNode;
};

type RouterContextValue = {
  path: string;
  navigate: (to: string) => void;
};

const RouterContext = React.createContext<RouterContextValue | null>(null);

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

export function Router({ routes }: { routes: Route[] }) {
  const [path, setPath] = useState(() => hashToPath(window.location.hash));

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = '#/';
      setPath('/');
    }

    const handleHashChange = () => {
      setPath(hashToPath(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (to: string) => {
    const nextHash = pathToHash(to);
    if (window.location.hash === nextHash) return;
    window.location.hash = nextHash;
  };

  const value = useMemo<RouterContextValue>(() => ({ path, navigate }), [path]);
  const activeRoute = useMemo(() => {
    for (const route of routes) {
      if (matchPath(path, route.path)) {
        return route;
      }
    }
    return routes.find((route) => route.path === '*') ?? null;
  }, [path, routes]);

  return (
    <RouterContext.Provider value={value}>
      {activeRoute ? activeRoute.element : null}
    </RouterContext.Provider>
  );
}

export function useRoute() {
  const ctx = React.useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRoute must be used within a Router');
  }
  return ctx;
}

export function useNavigate() {
  return useRoute().navigate;
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
