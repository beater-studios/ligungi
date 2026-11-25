import { useEffect } from 'preact/hooks';
import { getT, useT } from './i18n/index.ts';
import { notify } from './notify.ts';
import { CookieBanner } from './layout/Consent.tsx';
import { ActivityFooter, useActivityChrome } from './discord/Hub.tsx';
import { inActivity } from './discord/activity.ts';
import { ConnectionToast } from './layout/ConnectionToast.tsx';
import { matchRoute, navigate, useLocation } from './core/router.ts';
import { applyHead } from './seo.ts';
import { socket } from './core/socket.ts';
import { NotFound, ROUTES } from './routes.tsx';
import { Header } from './layout/Header.tsx';
import { SiteFooter } from './layout/SiteFooter.tsx';

const FULL_SCREEN = /^\/([A-Za-z0-9]{8}|computer|analysis)$/;

export const App = () => {
  const { path } = useLocation();
  const t = useT();
  const content = matchRoute(ROUTES, path);
  useActivityChrome(path);
  const found = content !== undefined;
  useEffect(() => applyHead(t, path, found), [t, path, found]);
  useEffect(
    () =>
      socket.on((message) => {
        if (message.t !== 'redirect') return;
        navigate(message.path);
        const { gameStarted, gameStartedBody } = getT().notify;
        notify({ title: gameStarted, body: gameStartedBody, tag: `start:${message.path}`, path: message.path });
      }),
    [],
  );
  return (
    <>
      <Header />
      <div id="main-wrap" class={`is2d${FULL_SCREEN.test(path) ? ' full-screen-force' : ''}`}>
        {content ?? <NotFound />}
      </div>
      {inActivity ? <ActivityFooter /> : <SiteFooter />}
      <CookieBanner />
      <ConnectionToast />
    </>
  );
};
