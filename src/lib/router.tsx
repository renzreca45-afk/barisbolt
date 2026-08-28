import { useState, useEffect, type ReactNode } from 'react';

export type Route =
  | 'dashboard'
  | 'residents'
  | 'households'
  | 'documents'
  | 'transactions'
  | 'reports'
  | 'admin';

export interface RouteState {
  route: Route;
  params: Record<string, string>;
}

function parseHash(): RouteState {
  const hash = window.location.hash.slice(1) || '/dashboard';
  const [path, queryString] = hash.split('?');
  const segments = path.split('/').filter(Boolean);
  const route = (segments[0] as Route) || 'dashboard';
  const params: Record<string, string> = {};

  if (segments[1]) {
    params.id = segments[1];
  }

  if (queryString) {
    const searchParams = new URLSearchParams(queryString);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  }

  return { route, params };
}

export function navigate(route: Route, params?: Record<string, string>) {
  let hash = `/${route}`;
  if (params?.id) {
    hash += `/${params.id}`;
  }
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (key !== 'id') searchParams.set(key, value);
    });
  }
  const qs = searchParams.toString();
  if (qs) hash += `?${qs}`;
  window.location.hash = hash;
}

export function useRouter() {
  const [state, setState] = useState<RouteState>(parseHash());

  useEffect(() => {
    const handler = () => {
      setState(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return state;
}

export function Link({
  to,
  params,
  children,
  className,
  onClick,
}: {
  to: Route;
  params?: Record<string, string>;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(to, params);
    onClick?.();
  };
  return (
    <a href={`#/${to}`} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
