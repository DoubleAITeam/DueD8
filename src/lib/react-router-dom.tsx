import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

type NavigationOptions = {
  replace?: boolean;
};

type RouterContextValue = {
  pathname: string;
  navigate: (to: string, options?: NavigationOptions) => void;
};

const RouterContext = createContext<RouterContextValue | null>(null);
const ParamsContext = createContext<Record<string, string>>({});

function normalizePath(path: string): string {
  if (!path) return '/';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.replace(/\/+$/, '') || '/';
}

function getInitialPath(): string {
  if (typeof window === 'undefined') {
    return '/';
  }

  return normalizePath(window.location.pathname || '/');
}

type BrowserRouterProps = {
  children?: React.ReactNode;
};

export function BrowserRouter({ children }: BrowserRouterProps) {
  const [pathname, setPathname] = useState<string>(() => getInitialPath());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handlePopState = () => {
      setPathname(normalizePath(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to: string, options?: NavigationOptions) => {
    if (typeof window === 'undefined') return;

    const target = normalizePath(to);
    if (options?.replace) {
      window.history.replaceState(null, '', target);
    } else {
      window.history.pushState(null, '', target);
    }
    setPathname(target);
  }, []);

  const value = useMemo<RouterContextValue>(
    () => ({ pathname, navigate }),
    [pathname, navigate]
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

type RouteProps = {
  path: string;
  element: React.ReactNode;
};

type RouteMatch = {
  matched: boolean;
  params: Record<string, string>;
};

function matchPath(pathPattern: string, current: string): RouteMatch {
  const patternSegments = normalizePath(pathPattern).split('/').filter(Boolean);
  const currentSegments = normalizePath(current).split('/').filter(Boolean);

  if (patternSegments.length !== currentSegments.length) {
    return { matched: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternSegments.length; i += 1) {
    const patternSegment = patternSegments[i];
    const currentSegment = currentSegments[i];

    if (patternSegment.startsWith(':')) {
      params[patternSegment.slice(1)] = decodeURIComponent(currentSegment);
      continue;
    }

    if (patternSegment !== currentSegment) {
      return { matched: false, params: {} };
    }
  }

  return { matched: true, params };
}

function useRouterContext(): RouterContextValue {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouterContext must be used within a BrowserRouter');
  }
  return context;
}

export function Routes({ children }: { children?: React.ReactNode }) {
  const { pathname } = useRouterContext();
  const childArray = React.Children.toArray(children) as React.ReactElement<RouteProps>[];

  for (const child of childArray) {
    if (!React.isValidElement<RouteProps>(child)) {
      continue;
    }

    const { path, element } = child.props;
    const match = matchPath(path, pathname);

    if (match.matched) {
      return <ParamsContext.Provider value={match.params}>{element}</ParamsContext.Provider>;
    }
  }

  return null;
}

export function Route(_props: RouteProps) {
  return null;
}

type NavLinkProps = {
  to: string;
  children?: React.ReactNode;
  className?: string | ((state: { isActive: boolean }) => string | undefined);
  style?: React.CSSProperties | ((state: { isActive: boolean }) => React.CSSProperties | undefined);
};

export function NavLink({ to, children, className, style }: NavLinkProps) {
  const { pathname, navigate } = useRouterContext();
  const normalizedTo = normalizePath(to);
  const isActive = pathname === normalizedTo;

  const computedClassName = useMemo(() => {
    if (typeof className === 'function') {
      return className({ isActive }) ?? undefined;
    }
    return className ?? undefined;
  }, [className, isActive]);

  const computedStyle = useMemo(() => {
    if (typeof style === 'function') {
      return style({ isActive }) ?? undefined;
    }
    return style;
  }, [style, isActive]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      if (isActive) return;
      navigate(normalizedTo);
    },
    [isActive, navigate, normalizedTo]
  );

  return (
    <a href={normalizedTo} onClick={handleClick} className={computedClassName} style={computedStyle}>
      {children}
    </a>
  );
}

export function useParams<Params extends Record<string, string | undefined> = Record<string, string | undefined>>() {
  return useContext(ParamsContext) as Params;
}

export function useNavigate() {
  const { navigate } = useRouterContext();
  return navigate;
}

export function useLocation() {
  const { pathname } = useRouterContext();
  return { pathname };
}

export type { RouteProps };

export default {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams
};
