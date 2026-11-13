import type { VNode } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { MESSAGES, themeLabel, useT } from './i18n/index.ts';
import logoUrl from './assets/logo.svg';
import { icons } from './icons.ts';
import { SOURCE_URL } from './source.ts';
import { COMMIT, VERSION } from './version.ts';
import { AnalysisPage } from './pages/AnalysisPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { ChallengePage } from './pages/ChallengePage.tsx';
import { ComputerPage } from './pages/ComputerPage.tsx';
import { CookieBanner } from './components/Consent.tsx';
import { DesignPage } from './pages/DesignPage.tsx';
import { FriendsPage } from './pages/FriendsPage.tsx';
import { INFO_KINDS, InfoPage, isInfoKind } from './pages/InfoPage.tsx';
import { GamePage } from './pages/GamePage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { LearnPage } from './pages/LearnPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { PlayersPage } from './pages/PlayersPage.tsx';
import { RankingPage } from './pages/RankingPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { AccountPage } from './pages/AccountPage.tsx';
import { ChallengeBell } from './components/ChallengeBell.tsx';
import { HeaderSearch } from './components/HeaderSearch.tsx';
import { useDropdown } from './components/useDropdown.ts';
import { TvPage } from './pages/TvPage.tsx';
import { MODES, type Mode } from '@ligungi/engine';
import { LANGS, THEMES, prefs, resolveLang, updatePrefs } from './prefs.ts';
import { matchRoute, navigate, useLocation, type Route } from './router.ts';
import { logout, session } from './session.ts';
import { LINKS } from './i18n/content/shared.tsx';
import { applyHead } from './seo.ts';
import { socket } from './socket.ts';
import { useStore } from './store.ts';


const ROUTES: Route<VNode>[] = [
  { pattern: /^\/$/, render: () => <HomePage /> },
  { pattern: /^\/computer$/, render: () => <ComputerPage /> },
  { pattern: /^\/analysis$/, render: () => <AnalysisPage /> },
  { pattern: /^\/learn$/, render: () => <LearnPage /> },
  { pattern: /^\/tv$/, render: () => <TvPage /> },
  { pattern: /^\/settings$/, render: () => <SettingsPage /> },
  { pattern: /^\/account$/, render: () => <AccountPage /> },
  { pattern: /^\/friends$/, render: () => <FriendsPage /> },
  { pattern: /^\/design$/, render: () => <DesignPage /> },
  { pattern: new RegExp(`^/(${INFO_KINDS.join('|')})$`), render: ([kind]) => (isInfoKind(kind!) ? <InfoPage kind={kind} /> : <NotFound />) },
  { pattern: /^\/players$/, render: () => <PlayersPage /> },
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

type DasherView = 'main' | 'language' | 'theme';

/**
 * lila's dasher: account and settings links on top, then submenus that open a second panel with a back button,
 * so the language and theme choices never hide the link to the full settings page.
 */
const Dasher = () => {
  const t = useT();
  const { user } = useStore(session);
  const current = useStore(prefs);
  const { shown, setShown, ref } = useDropdown();
  const [view, setView] = useState<DasherView>('main');
  const { path } = useLocation();
  useEffect(() => setShown(false), [path]);
  useEffect(() => {
    if (!shown) setView('main');
  }, [shown]);
  const lang = resolveLang(current.lang);

  const back = (label: string) => (
    <button type="button" class="head text" data-icon={icons.LessThan} onClick={() => setView('main')}>
      {label}
    </button>
  );

  return (
    <div class={`dasher${shown ? ' shown' : ''}`} ref={ref}>
      {user ? (
        <button id="user_tag" type="button" class="toggle link" aria-expanded={shown} onClick={() => setShown(!shown)}>
          {user.name}
        </button>
      ) : (
        <button
          type="button"
          class="toggle anon link"
          title={t.nav.settings}
          aria-label={t.nav.settings}
          aria-expanded={shown}
          data-icon={icons.Gear}
          onClick={() => setShown(!shown)}
        />
      )}
      {shown && (
        <div id="dasher_app" class="dropdown ligungi-dasher">
          {view === 'main' && (
            <>
              <div class="links">
                {user && (
                  <>
                    <a class="user-link online text" href={`/@/${user.name}`} data-icon={icons.User}>
                      {user.name}
                    </a>
                    <a class="text" href="/friends" data-icon={icons.Group}>
                      {t.nav.friends}
                    </a>
                  </>
                )}
                <a class="text" href="/settings" data-icon={icons.Gear}>
                  {t.nav.settings}
                </a>
                {user && (
                  <a class="text" href="/account" data-icon={icons.AccountCircle}>
                    {t.nav.account}
                  </a>
                )}
                {user && (
                  <form class="logout" onSubmit={(e) => e.preventDefault()}>
                    <button type="button" class="text" data-icon={icons.Power} onClick={() => void logout().then(() => navigate('/'))}>
                      {t.nav.signOut}
                    </button>
                  </form>
                )}
              </div>
              <div class="subs">
                <button type="button" class="sub" data-icon={icons.Language} onClick={() => setView('language')}>
                  <span>{t.nav.language}</span>
                  <span class="ligungi-dasher__value">{MESSAGES[lang].languageName}</span>
                </button>
                <button type="button" class="sub" data-icon={icons.Switch} onClick={() => setView('theme')}>
                  <span>{t.settings.theme}</span>
                  <span class="ligungi-dasher__value">{themeLabel(t, current.theme)}</span>
                </button>
              </div>
            </>
          )}
          {view === 'language' && (
            <div class="langs">
              {back(t.nav.language)}
              <form role="group" aria-label={t.nav.language} onSubmit={(e) => e.preventDefault()}>
                {(['auto', ...LANGS] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    lang={option === 'auto' ? undefined : MESSAGES[option].locale}
                    class={current.lang === option ? 'current' : ''}
                    aria-pressed={current.lang === option}
                    onClick={() => updatePrefs({ lang: option })}
                  >
                    {option === 'auto' ? t.settings.auto : MESSAGES[option].languageName}
                  </button>
                ))}
              </form>
            </div>
          )}
          {view === 'theme' && (
            <div class="langs">
              {back(t.settings.theme)}
              <form role="group" aria-label={t.settings.theme} onSubmit={(e) => e.preventDefault()}>
                {THEMES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    class={current.theme === option ? 'current' : ''}
                    aria-pressed={current.theme === option}
                    onClick={() => updatePrefs({ theme: option })}
                  >
                    {themeLabel(t, option)}
                  </button>
                ))}
              </form>
            </div>
          )}
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
            <a href="/players">{t.nav.community}</a>
            <div role="group">
              <a href="/players">{t.nav.playerList}</a>
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
        <HeaderSearch />
        {user && <ChallengeBell />}
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

const footerLink = (href: string, label: string) => {
  const external = href.startsWith('http');
  return (
    <li key={href}>
      <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {label}
      </a>
    </li>
  );
};

export const SiteFooter = () => {
  const t = useT();
  const columns: Array<{ title: string; links: Array<[string, string]> }> = [
    {
      title: t.footer.siteTitle,
      links: [
        ['/about', t.nav.about],
        ['/faq', t.nav.faq],
        ['/contact', t.nav.contact],
        [LINKS.status, t.nav.status],
      ],
    },
    {
      title: t.footer.playTitle,
      links: [
        ['/learn', t.nav.learn],
        ['/computer', t.nav.playComputer],
        ['/analysis', t.nav.analysis],
        ['/players', t.nav.playerList],
        ['/ranking', t.nav.players],
        ['/tv', t.nav.liveGames],
      ],
    },
    {
      title: t.footer.codeTitle,
      links: [
        [SOURCE_URL, t.footer.sourceCode],
        [LINKS.lila, t.footer.basedOnLila],
        ['/terms', t.nav.terms],
        ['/privacy', t.nav.privacy],
      ],
    },
  ];
  return (
    <footer class="ligungi-footer">
      <div class="ligungi-footer__main">
        <div class="ligungi-footer__brand">
          <a class="ligungi-footer__logo" href="/">
            <img src={logoUrl} alt="" width="32" height="32" />
            <span>
              ligungi<span class="ligungi-footer__tld">.org</span>
            </span>
          </a>
          <p>{t.footer.tagline}</p>
          <p class="ligungi-footer__studio">{t.footer.studio}</p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} class="ligungi-footer__column" aria-label={column.title}>
            <span class="ligungi-footer__title">{column.title}</span>
            <ul>{column.links.map(([href, label]) => footerLink(href, label))}</ul>
          </nav>
        ))}
      </div>
      <div class="ligungi-footer__bottom">
        <span>{t.footer.trademark}</span>
        <span class="ligungi-footer__version">
          v{VERSION}
          {COMMIT !== 'dev' &&
            (COMMIT.endsWith('-dirty') ? (
              ` (${COMMIT})`
            ) : (
              <>
                {' '}(
                <a href={`${SOURCE_URL}/commit/${COMMIT}`} target="_blank" rel="noopener noreferrer">
                  {COMMIT}
                </a>
                )
              </>
            ))}
        </span>
      </div>
    </footer>
  );
};

const FULL_SCREEN = /^\/([A-Za-z0-9]{8}|computer|analysis)$/;

export const App = () => {
  const { path } = useLocation();
  const t = useT();
  const content = matchRoute(ROUTES, path);
  const found = content !== undefined;
  useEffect(() => applyHead(t, path, found), [t, path, found]);
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
        {content ?? <NotFound />}
      </div>
      <SiteFooter />
      <CookieBanner />
    </>
  );
};
