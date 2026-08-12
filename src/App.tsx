/**
 * Lightweight History API routing keeps the starter small while supporting
 * canonical collection and Planet detail deep links.
 */
import type { ReactNode } from 'react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import type { NavKey } from '@/components/layout/Nav';
import { navPath, parseAppRoute } from '@/lib/appRoute';
import { Home } from '@/pages/Home';
import { Leaderboard } from '@/pages/Leaderboard';
import { Play } from '@/pages/Play';
import { Tickets } from '@/pages/Tickets';

const Planets = lazy(() =>
  import('@/pages/Planets').then((module) => ({ default: module.Planets })),
);
const Lab = import.meta.env.DEV
  ? lazy(() => import('@/pages/Lab').then((module) => ({ default: module.Lab })))
  : null;

export default function App() {
  const [route, setRoute] = useState(() => parseAppRoute(window.location.pathname));
  const active = route.active;

  const navigate = useCallback((key: NavKey) => {
    const pathname = navPath(key);
    window.history.pushState({}, '', pathname);
    setRoute(parseAppRoute(pathname));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const viewPlanet = useCallback((tokenId: string) => {
    const pathname = `/planet/${tokenId}`;
    window.history.pushState({}, '', pathname);
    setRoute(parseAppRoute(pathname));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(parseAppRoute(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  let page: ReactNode;
  switch (active) {
    case 'home':
      page = <Home onNavigate={navigate} />;
      break;
    case 'play':
      page = <Play />;
      break;
    case 'tickets':
      page = <Tickets onNavigate={navigate} />;
      break;
    case 'planets':
      page = <Planets onNavigate={navigate} onViewPlanet={viewPlanet} routePlanetId={route.planetId} />;
      break;
    case 'lab':
      page = Lab ? <Lab /> : <Home onNavigate={navigate} />;
      break;
    case 'history':
      page = <Leaderboard />;
      break;
  }

  return (
    <Layout active={active} onSelect={navigate}>
      <Suspense fallback={<div className="card-pad text-sm text-zinc-400">Loading…</div>}>
        {page}
      </Suspense>
    </Layout>
  );
}
