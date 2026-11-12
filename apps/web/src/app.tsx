import type { VNode } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { MESSAGES, useT } from './i18n/index.ts';
import logoUrl from './assets/logo.svg';
import { icons } from './icons.ts';
import { AnalysisPage } from './pages/AnalysisPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { ChallengePage } from './pages/ChallengePage.tsx';
import { ComputerPage } from './pages/ComputerPage.tsx';
import { FriendsPage } from './pages/FriendsPage.tsx';
import { GamePage } from './pages/GamePage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { LearnPage } from './pages/LearnPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { RankingPage } from './pages/RankingPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { TvPage } from './pages/TvPage.tsx';
import { MODES, type Mode } from '@ligungi/engine';
import { LANGS, prefs, resolveLang, updatePrefs } from './prefs.ts';
import { matchRoute, navigate, useLocation, type Route } from './router.ts';
import { logout, session } from './session.ts';
import { socket } from './socket.ts';
import { useStore } from './store.ts';

export const SOURCE_URL =
  (import.meta.env.VITE_SOURCE_URL as string | undefined) ?? 'https://github.com/beater-studios/ligungi';

const ROUTES: Route<VNode>[] = [
  { pattern: /^\/$/, render: () => <HomePage /> },
  { pattern: /^\/computer$/, render: () => <ComputerPage /> },
  { pattern: /^\/analysis$/, render: () => <AnalysisPage /> },
  { pattern: /^\/learn$/, render: () => <LearnPage /> },
  { pattern: /^\/tv$/, render: () => <TvPage /> },
  { pattern: /^\/settings$/, render: () => <SettingsPage /> },
  { pattern: /^\/friends$/, render: () => <FriendsPage /> },
  { pattern: /^\/ranking$/, render: () => <RankingPage /> },
  { pattern: new RegExp(`^/ranking/(${MODES.join('|')})$`), render: ([mode]) => <RankingPage mode={mode as Mode} /> },
  { pattern: /^\/login$/, render: () => <AuthPage signup={false} /> },
  { pattern: /^\/signup$/, render: () => <AuthPage signup /> },
  { pattern: /^\/@\/([A-Za-z0-9_-]+)$/, render: ([name]) => <ProfilePage name={name!} /> },
  { pattern: /^\/challenge\/([A-Za-z0-9]+)$/, render: ([id]) => <ChallengePage id={id!} /> },
  { pattern: /^\/([A-Za-z0-9]{8})$/, render: ([id]) => <GamePage id={id!} /> },
];

const NotFound = () => {
  const t = useT();
  return (
    <main class="page-small box box-pad page">
      <h1 class="box__top">{t.notFound.title}</h1>
      <p>
        <a href="/">{t.notFound.back}</a>
      </p>
    </main>
  );
};

const LanguagePicker = () => {
  const t = useT();
  const current = resolveLang(useStore(prefs).lang);
  return (
    <div class="langs">
      <form role="group" aria-label={t.nav.language} onSubmit={(e) => e.preventDefault()}>
        {LANGS.map((lang) => (
          <button
            key={lang}
            type="button"
            lang={MESSAGES[lang].locale}
            class={lang === current ? 'current' : ''}
            aria-pressed={lang === current}
            onClick={() => updatePrefs({ lang })}
          >
            {MESSAGES[lang].languageName}
          </button>
        ))}
      </form>
    </div>
  );
};

/** Closes a header dropdown when clicking anywhere else, like lila's top bar. */
const useDropdown = () => {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shown) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setShown(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [shown]);
  return { shown, setShown, ref };
};

const Dasher = () => {
  const t = useT();
  const { user } = useStore(session);
  const { shown, setShown, ref } = useDropdown();
  const { path } = useLocation();
  useEffect(() => setShown(false), [path]);
  return (
    <div class={`dasher${shown ? ' shown' : ''}`} ref={ref}>
      {user ? (
        <button id="user_tag" type="button" class="toggle link" onClick={() => setShown(!shown)}>
          {user.name}
        </button>
      ) : (
        <button
          type="button"
          class="toggle anon link"
          title={t.nav.settings}
          aria-label={t.nav.settings}
          data-icon={icons.Gear}
          onClick={() => setShown(!shown)}
        />
      )}
      {shown && (
        <div id="dasher_app" class="dropdown">
          <div class="links">
            {user && (
              <a class="user-link online text" href={`/@/${user.name}`} data-icon={icons.User}>
                {user.name}
              </a>
            )}
            {user && (
              <a class="text" href="/friends" data-icon={icons.Group}>
                {t.nav.friends}
              </a>
            )}
            <a class="text" href="/settings" data-icon={icons.Gear}>
              {t.nav.settings}
            </a>
            {user && (
              <form class="logout" onSubmit={(e) => e.preventDefault()}>
                <button
                  type="button"
                  class="text"
                  data-icon={icons.Power}
                  onClick={() => void logout().then(() => navigate('/'))}
                >
                  {t.nav.signOut}
                </button>
              </form>
            )}
          </div>
          <LanguagePicker />
        </div>
      )}
    </div>
  );
};

const Header = () => {
  const t = useT();
  const { user } = useStore(session);
  const status = useStore(socket.status);
  const toggle = useRef<HTMLInputElement>(null);
  const { path } = useLocation();
  useEffect(() => {
    if (toggle.current) toggle.current.checked = false;
  }, [path]);
  return (
    <header id="top">
      <div class="site-title-nav">
        <input type="checkbox" id="tn-tg" class="topnav-toggle fullscreen-toggle" autocomplete="off" aria-label={t.nav.navigation} ref={toggle} />
        <label for="tn-tg" class="fullscreen-mask" />
        <label for="tn-tg" class="hbg">
          <span class="hbg__in" />
        </label>
        <a class="site-title" href="/">
          <img class="site-icon ligungi-logo" src={logoUrl} alt="" width="32" height="32" />
          <div class="site-name">
            ligungi<span>.org</span>
          </div>
        </a>
        <nav id="topnav" class="hover">
          <section>
            <a href="/">
              <span class="play">{t.nav.play}</span>
              <span class="home">ligungi.org</span>
            </a>
            <div role="group">
              <a href="/?create=lobby">{t.nav.createGame}</a>
              <a href="/?create=friend">{t.nav.playFriend}</a>
              <a href="/computer">{t.nav.playComputer}</a>
            </div>
          </section>
          <section>
            <a href="/learn">{t.nav.learn}</a>
            <div role="group">
              <a href="/learn">{t.nav.rules}</a>
            </div>
          </section>
          <section>
            <a href="/ranking">{t.nav.community}</a>
            <div role="group">
              <a href="/ranking">{t.nav.players}</a>
              <a href="/friends">{t.nav.friends}</a>
            </div>
          </section>
          <section>
            <a href="/tv">{t.nav.watch}</a>
            <div role="group">
              <a href="/tv">{t.nav.liveGames}</a>
            </div>
          </section>
          <section>
            <a href="/analysis">{t.nav.tools}</a>
            <div role="group">
              <a href="/analysis">{t.nav.analysis}</a>
            </div>
          </section>
        </nav>
      </div>
      <div class="site-buttons">
        {status !== 'open' && (
          <span class="link ligungi-reconnecting" title={t.nav.reconnecting} data-icon={icons.ChasingArrows} />
        )}
        {!user && (
          <div class="signin-or-signup">
            <a href="/login" class="button button-empty signin">
              {t.nav.signIn}
            </a>
            <a href="/signup" class="button signup">
              {t.nav.signUp}
            </a>
          </div>
        )}
        <Dasher />
      </div>
    </header>
  );
};

export const SiteFooter = () => {
  const t = useT();
  return (
    <footer class="ligungi-footer">
      <span>{t.footer.source(SOURCE_URL)}</span>
      <span>{t.footer.trademark}</span>
      <span class="ligungi-footer__studio">{t.footer.studio}</span>
    </footer>
  );
};

const FULL_SCREEN = /^\/([A-Za-z0-9]{8}|computer|analysis)$/;

export const App = () => {
  const { path } = useLocation();
  const t = useT();
  useEffect(() => {
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.metaDescription);
  }, [t]);
  useEffect(
    () =>
      socket.on((message) => {
        if (message.t === 'redirect') navigate(message.path);
      }),
    [],
  );
  return (
    <>
      <Header />
      <div id="main-wrap" class={`is2d${FULL_SCREEN.test(path) ? ' full-screen-force' : ''}`}>
        {matchRoute(ROUTES, path) ?? <NotFound />}
      </div>
      <SiteFooter />
    </>
  );
};
