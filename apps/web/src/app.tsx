import { PIECE_STYLES } from '@ligungi/board';
import type { VNode } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { getT, setLanguage, themeLabel, useT } from './i18n/index.ts';
import { languageName, localeOf } from './i18n/languages.ts';
import { notify } from './notify.ts';
import logoUrl from './assets/logo.svg';
import { icons } from './icons.ts';
import { SOURCE_URL } from './source.ts';
import { COMMIT, VERSION } from './version.ts';
import { AnalysisPage } from './pages/AnalysisPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { ChallengePage } from './pages/ChallengePage.tsx';
import { ComputerPage } from './pages/ComputerPage.tsx';
import { CoordinatesPage } from './pages/CoordinatesPage.tsx';
import { CookieBanner } from './components/Consent.tsx';
import { DesignPage } from './pages/DesignPage.tsx';
import { FriendsPage } from './pages/FriendsPage.tsx';
import { GameSearchPage } from './pages/GameSearchPage.tsx';
import { InsightsPage } from './pages/InsightsPage.tsx';
import { INFO_KINDS, InfoPage, isInfoKind } from './pages/InfoPage.tsx';
import { GamePage } from './pages/GamePage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { LearnPage } from './pages/LearnPage.tsx';
import { LessonsPage } from './pages/LessonsPage.tsx';
import { PracticePage } from './pages/PracticePage.tsx';
import { PuzzleDashboardPage } from './pages/PuzzleDashboardPage.tsx';
import { PuzzleRunPage } from './pages/PuzzleRunPage.tsx';
import { PuzzlesPage } from './pages/PuzzlesPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { PlayersPage } from './pages/PlayersPage.tsx';
import { RankingPage } from './pages/RankingPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { StudiesPage } from './pages/StudiesPage.tsx';
import { StudyPage } from './pages/StudyPage.tsx';
import { AccountPage } from './pages/AccountPage.tsx';
import { ModPage } from './pages/ModPage.tsx';
import { EditorPage } from './pages/EditorPage.tsx';
import { ExplorerPage } from './pages/ExplorerPage.tsx';
import { ChallengeBell } from './components/ChallengeBell.tsx';
import { HeaderSearch } from './components/HeaderSearch.tsx';
import { useDropdown } from './components/useDropdown.ts';
import { TvChannelPage } from './pages/TvChannelPage.tsx';
import { TvPage } from './pages/TvPage.tsx';
import { MODES, type Mode } from '@ligungi/engine';
import { LESSON_STAGE_IDS, SHORT_LINKS, TV_CHANNELS, type TvChannel } from '@ligungi/protocol';
import { Swatch, boardFaces, boardThemeLabel, paletteFaces, paletteLabel, shapeLabel, styleLabel } from './looks.tsx';
import { BOARD_THEMES, LANGS, OPPONENT_PIECES, PIECE_PALETTES, PIECE_SHAPES, THEMES, prefs, resolveLang, updatePrefs } from './prefs.ts';
import { matchRoute, navigate, useLocation, type Route } from './router.ts';
import { logout, session } from './session.ts';
import { LINKS } from './i18n/content/shared.tsx';
import { applyHead } from './seo.ts';
import { socket } from './socket.ts';
import { useStore } from './store.ts';


/** A short link reached inside the site (the server redirects it on a full page load): leave for its target. */
const ShortLink = ({ to }: { to: string }) => {
  const t = useT();
  useEffect(() => window.location.replace(to), [to]);
  return (
    <main class="ligungi-page">
      <p class="ligungi-notice">{t.common.loading}</p>
    </main>
  );
};

const ROUTES: Route<VNode>[] = [
  ...Object.entries(SHORT_LINKS).map(([path, to]): Route<VNode> => ({ pattern: new RegExp(`^${path}$`), render: () => <ShortLink to={to} /> })),
  { pattern: /^\/$/, render: () => <HomePage /> },
  { pattern: /^\/computer$/, render: () => <ComputerPage /> },
  { pattern: /^\/analysis$/, render: () => <AnalysisPage /> },
  { pattern: /^\/editor$/, render: () => <EditorPage /> },
  { pattern: /^\/learn$/, render: () => <LearnPage /> },
  { pattern: /^\/lessons$/, render: () => <LessonsPage /> },
  { pattern: new RegExp(`^/lessons/(${LESSON_STAGE_IDS.join('|')})$`), render: ([stage]) => <LessonsPage stage={stage!} /> },
  { pattern: new RegExp(`^/lessons/(${LESSON_STAGE_IDS.join('|')})/(\\d{1,2})$`), render: ([stage, n]) => <LessonsPage stage={stage!} exercise={Number(n)} /> },
  { pattern: /^\/coordinates$/, render: () => <CoordinatesPage /> },
  { pattern: /^\/study$/, render: () => <StudiesPage /> },
  { pattern: /^\/study\/([A-Za-z0-9]{8})$/, render: ([id]) => <StudyPage key={id} id={id!} /> },
  { pattern: /^\/explorer$/, render: () => <ExplorerPage /> },
  { pattern: /^\/games$/, render: () => <GameSearchPage /> },
  { pattern: /^\/practice$/, render: () => <PracticePage /> },
  { pattern: /^\/practice\/([a-z-]{1,40})$/, render: ([id]) => <PracticePage id={id!} /> },
  { pattern: /^\/puzzles$/, render: () => <PuzzlesPage /> },
  { pattern: /^\/streak$/, render: () => <PuzzleRunPage key="streak" kind="streak" /> },
  { pattern: /^\/storm$/, render: () => <PuzzleRunPage key="storm" kind="storm" /> },
  { pattern: /^\/puzzles\/daily$/, render: () => <PuzzlesPage daily /> },
  { pattern: /^\/puzzles\/dashboard$/, render: () => <PuzzleDashboardPage /> },
  { pattern: /^\/puzzles\/([0-9a-f]{8})$/, render: ([id]) => <PuzzlesPage id={id!} /> },
  // The mate problems became puzzles: old links keep working.
  { pattern: /^\/problems$/, render: () => <Redirect to="/puzzles" /> },
  { pattern: /^\/problems\/([0-9a-f]{8})$/, render: ([id]) => <Redirect to={`/puzzles/${id!}`} /> },
  { pattern: /^\/tv$/, render: () => <TvPage /> },
  { pattern: new RegExp(`^/tv/(${TV_CHANNELS.join('|')})$`), render: ([channel]) => <TvChannelPage channel={channel as TvChannel} /> },
  { pattern: /^\/settings$/, render: () => <SettingsPage /> },
  { pattern: /^\/account$/, render: () => <AccountPage section="profile" /> },
  { pattern: /^\/account\/(privacy|security|data)$/, render: ([section]) => <AccountPage section={section === 'security' ? 'security' : section === 'data' ? 'data' : 'privacy'} /> },
  { pattern: /^\/mod$/, render: () => <ModPage /> },
  { pattern: /^\/friends$/, render: () => <FriendsPage /> },
  { pattern: /^\/design$/, render: () => <DesignPage /> },
  { pattern: new RegExp(`^/(${INFO_KINDS.join('|')})$`), render: ([kind]) => (isInfoKind(kind!) ? <InfoPage kind={kind} /> : <NotFound />) },
  { pattern: /^\/players$/, render: () => <PlayersPage /> },
  { pattern: /^\/ranking$/, render: () => <RankingPage /> },
  { pattern: new RegExp(`^/ranking/(${MODES.join('|')})$`), render: ([mode]) => <RankingPage mode={mode as Mode} /> },
  { pattern: /^\/login$/, render: () => <AuthPage signup={false} /> },
  { pattern: /^\/signup$/, render: () => <AuthPage signup /> },
  { pattern: /^\/@\/([A-Za-z0-9_-]+)$/, render: ([name]) => <ProfilePage name={name!} /> },
  { pattern: /^\/@\/([A-Za-z0-9_-]+)\/insights$/, render: ([name]) => <InsightsPage name={name!} /> },
  { pattern: /^\/challenge\/([A-Za-z0-9]+)$/, render: ([id]) => <ChallengePage id={id!} /> },
  { pattern: /^\/([A-Za-z0-9]{8})$/, render: ([id]) => <GamePage id={id!} /> },
];

/** Sends an old address to its new place, replacing it in the history. */
const Redirect = ({ to }: { to: string }) => {
  useEffect(() => navigate(to, true), [to]);
  return null;
};

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

type DasherView = 'main' | 'language' | 'theme' | 'board' | 'pieces';

/** One choice in a dasher submenu: marked when it is the current one, with an optional swatch. */
const DasherChoice = ({ current, label, swatch, onPick }: { current: boolean; label: string; swatch?: readonly [string, string]; onPick: () => void }) => (
  <button type="button" class={current ? 'current' : ''} aria-pressed={current} onClick={onPick}>
    {swatch && <Swatch faces={swatch} />}
    {label}
  </button>
);

/**
 * lila's dasher: account and settings links on top, then submenus that open a second panel with a back button,
 * so the language, theme, board and piece choices never hide the link to the full settings page.
 */
const Dasher = () => {
  const t = useT();
  const { user, moderator } = useStore(session);
  const current = useStore(prefs);
  const { shown, setShown, ref } = useDropdown();
  const [view, setView] = useState<DasherView>('main');
  const { path } = useLocation();
  useEffect(() => setShown(false), [path]);
  useEffect(() => {
    if (!shown) setView('main');
  }, [shown]);
  const lang = resolveLang(current.lang);
  const s = t.settings;
  const palette = current.pieceShape === 'koma' ? current.komaPalette : current.discPalette;
  const more = (
    <a class="ligungi-dasher__more" href="/settings">
      {t.nav.moreLooks}
    </a>
  );

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
                    <a class="text" href={`/@/${user.name}`} data-icon={icons.User}>
                      {t.nav.profile}
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
                {moderator && (
                  <a class="text" href="/mod" data-icon={icons.Agent}>
                    {t.nav.moderation}
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
                  <span class="ligungi-dasher__value">{languageName(lang)}</span>
                </button>
                <button type="button" class="sub" data-icon={icons.Switch} onClick={() => setView('theme')}>
                  <span>{t.settings.theme}</span>
                  <span class="ligungi-dasher__value">{themeLabel(t, current.theme)}</span>
                </button>
                <button type="button" class="sub ligungi-dasher__look" onClick={() => setView('board')}>
                  <Swatch faces={boardFaces(current.boardTheme, current.customBoard)} />
                  <span>{t.nav.board}</span>
                  <span class="ligungi-dasher__value">{boardThemeLabel(s, current.boardTheme)}</span>
                </button>
                <button type="button" class="sub ligungi-dasher__look" onClick={() => setView('pieces')}>
                  <Swatch faces={paletteFaces(palette, current.customPieces)} />
                  <span>{t.nav.pieces}</span>
                  <span class="ligungi-dasher__value">{current.pieceStyle === 'kanji' ? s.pieceStyleKanjiShort : styleLabel(s, current.pieceStyle)}</span>
                </button>
              </div>
            </>
          )}
          {view === 'language' && (
            <div class="langs">
              {back(t.nav.language)}
              <form onSubmit={(e) => e.preventDefault()}>
                <div role="group" aria-label={t.nav.language}>
                  {(['auto', ...LANGS] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      lang={option === 'auto' ? undefined : localeOf(option)}
                      class={current.lang === option ? 'current' : ''}
                      aria-pressed={current.lang === option}
                      onClick={() => void setLanguage(option)}
                    >
                      {option === 'auto' ? t.settings.auto : languageName(option)}
                    </button>
                  ))}
                </div>
              </form>
            </div>
          )}
          {view === 'theme' && (
            <div class="langs">
              {back(t.settings.theme)}
              <form onSubmit={(e) => e.preventDefault()}>
                <div role="group" aria-label={t.settings.theme}>
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
                </div>
              </form>
            </div>
          )}
          {view === 'board' && (
            <div class="langs">
              {back(t.nav.board)}
              <form onSubmit={(e) => e.preventDefault()}>
                <div role="group" aria-label={s.boardTheme}>
                  {BOARD_THEMES.map((option) => (
                    <DasherChoice
                      key={option}
                      current={current.boardTheme === option}
                      label={boardThemeLabel(s, option)}
                      swatch={boardFaces(option, current.customBoard)}
                      onPick={() => updatePrefs({ boardTheme: option })}
                    />
                  ))}
                </div>
              </form>
              {more}
            </div>
          )}
          {view === 'pieces' && (
            <div class="langs">
              {back(t.nav.pieces)}
              <form onSubmit={(e) => e.preventDefault()}>
                <p class="ligungi-dasher__group" id="dasher-shape">
                  {s.pieceShape}
                </p>
                <div role="group" aria-labelledby="dasher-shape">
                  {PIECE_SHAPES.map((option) => (
                    <DasherChoice key={option} current={current.pieceShape === option} label={shapeLabel(s, option)} onPick={() => updatePrefs({ pieceShape: option })} />
                  ))}
                </div>
                <p class="ligungi-dasher__group" id="dasher-style">
                  {s.pieceStyle}
                </p>
                <div role="group" aria-labelledby="dasher-style">
                  {PIECE_STYLES.map((option) => (
                    <DasherChoice key={option} current={current.pieceStyle === option} label={styleLabel(s, option)} onPick={() => updatePrefs({ pieceStyle: option })} />
                  ))}
                </div>
                {(current.pieceStyle === 'kanji' || current.pieceStyle === 'letters') && (
                  <>
                    <p class="ligungi-dasher__group" id="dasher-opponent">
                      {s.opponentPieces}
                    </p>
                    <div role="group" aria-labelledby="dasher-opponent">
                      {OPPONENT_PIECES.map((option) => (
                        <DasherChoice
                          key={option}
                          current={current.opponentPieces === option}
                          label={option === 'turned' ? s.opponentPiecesTurned : s.opponentPiecesUpright}
                          onPick={() => updatePrefs({ opponentPieces: option })}
                        />
                      ))}
                    </div>
                  </>
                )}
                <p class="ligungi-dasher__group" id="dasher-colors">
                  {s.pieceColors}
                </p>
                <div role="group" aria-labelledby="dasher-colors">
                  {current.pieceShape === 'koma'
                    ? PIECE_PALETTES.koma.map((option) => (
                        <DasherChoice
                          key={option}
                          current={current.komaPalette === option}
                          label={paletteLabel(s, option)}
                          swatch={paletteFaces(option, current.customPieces)}
                          onPick={() => updatePrefs({ komaPalette: option })}
                        />
                      ))
                    : PIECE_PALETTES.disc.map((option) => (
                        <DasherChoice
                          key={option}
                          current={current.discPalette === option}
                          label={paletteLabel(s, option)}
                          swatch={paletteFaces(option, current.customPieces)}
                          onPick={() => updatePrefs({ discPalette: option })}
                        />
                      ))}
                </div>
              </form>
              {more}
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
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (toggle.current) toggle.current.checked = false;
  }, [path]);
  // lila's sticky header only gets a background with this class, which its own scripts set while the page is scrolled.
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 0);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return (
    <header id="top" class={scrolled ? 'scrolled' : undefined}>
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
        <nav id="topnav" class="hover" aria-label={t.nav.navigation}>
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
            <a href="/puzzles">{t.nav.puzzles}</a>
            <div role="group">
              <a href="/puzzles">{t.nav.puzzles}</a>
              <a href="/puzzles/daily">{t.nav.puzzleDaily}</a>
              <a href="/streak">{t.nav.streak}</a>
              <a href="/storm">{t.nav.storm}</a>
              <a href="/puzzles/dashboard">{t.nav.puzzleDashboard}</a>
            </div>
          </section>
          <section>
            <a href="/learn">{t.nav.learn}</a>
            <div role="group">
              <a href="/learn">{t.nav.rules}</a>
              <a href="/lessons">{t.nav.lessons}</a>
              <a href="/practice">{t.nav.practice}</a>
              <a href="/study">{t.nav.studies}</a>
              <a href="/coordinates">{t.nav.coordinates}</a>
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
              <a href="/editor">{t.nav.editor}</a>
              <a href="/analysis?import">{t.nav.importGame}</a>
              <a href="/explorer">{t.nav.explorer}</a>
              <a href="/games">{t.nav.gameSearch}</a>
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
  // The columns follow the menus at the top; the site column also holds the code and the legal pages.
  const columns: Array<{ title: string; links: Array<[string, string]> }> = [
    {
      title: t.nav.play,
      links: [
        ['/?create=lobby', t.nav.createGame],
        ['/computer', t.nav.playComputer],
        ['/tv', t.nav.liveGames],
        ['/players', t.nav.playerList],
        ['/ranking', t.nav.players],
      ],
    },
    {
      title: t.nav.learn,
      links: [
        ['/learn', t.nav.rules],
        ['/lessons', t.nav.lessons],
        ['/puzzles', t.nav.puzzles],
        ['/practice', t.nav.practice],
        ['/study', t.nav.studies],
      ],
    },
    {
      title: t.nav.tools,
      links: [
        ['/analysis', t.nav.analysis],
        ['/editor', t.nav.editor],
        ['/explorer', t.nav.explorer],
        ['/games', t.nav.gameSearch],
        ['/analysis?import', t.nav.importGame],
      ],
    },
    {
      title: t.footer.siteTitle,
      links: [
        ['/about', t.nav.about],
        ['/faq', t.nav.faq],
        ['/contact', t.nav.contact],
        [LINKS.discord, t.nav.discord],
        ['/sites', t.nav.sites],
        [LINKS.status, t.nav.status],
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
      <SiteFooter />
      <CookieBanner />
    </>
  );
};
