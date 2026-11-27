import type { VNode } from 'preact';
import { useEffect } from 'preact/hooks';
import { useT } from './i18n/index.ts';
import { AnalysisPage } from './pages/AnalysisPage.tsx';
import { ArenaPage } from './pages/ArenaPage.tsx';
import { SeasonPage } from './pages/SeasonPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { ChallengePage } from './pages/ChallengePage.tsx';
import { ComputerPage } from './pages/ComputerPage.tsx';
import { CoordinatesPage } from './pages/CoordinatesPage.tsx';
import { DesignPage } from './pages/DesignPage.tsx';
import { FriendsPage } from './pages/FriendsPage.tsx';
import { GameSearchPage } from './pages/GameSearchPage.tsx';
import { InsightsPage } from './pages/InsightsPage.tsx';
import { INFO_KINDS, InfoPage, isInfoKind } from './pages/InfoPage.tsx';
import { GamePage } from './pages/GamePage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { ActivityHub } from './discord/Hub.tsx';
import { activityTab, inActivity } from './discord/activity.ts';
import { LearnPage } from './pages/LearnPage.tsx';
import { LessonsPage } from './pages/LessonsPage.tsx';
import { PracticePage } from './pages/PracticePage.tsx';
import { PuzzleDashboardPage } from './pages/PuzzleDashboardPage.tsx';
import { PuzzleRunPage } from './pages/PuzzleRunPage.tsx';
import { RacePage } from './pages/RacePage.tsx';
import { RacerPage } from './pages/RacerPage.tsx';
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
import { TvChannelPage } from './pages/TvChannelPage.tsx';
import { TvPage } from './pages/TvPage.tsx';
import { MODES, type Mode } from '@ligungi/engine';
import { SHORT_LINKS, TV_CHANNELS, type TvChannel } from '@ligungi/protocol';
import { LESSON_STAGE_IDS } from '@ligungi/content';
import { navigate, type Route } from './core/router.ts';
import { useStore } from './core/store.ts';

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

/** Inside Discord the home page starts on the call's rooms; the header switch goes back to the site's lobby. */
const Home = () => {
  const tab = useStore(activityTab);
  return inActivity && tab === 'call' ? <ActivityHub /> : <HomePage />;
};

export const ROUTES: Route<VNode>[] = [
  ...Object.entries(SHORT_LINKS).map(([path, to]): Route<VNode> => ({ pattern: new RegExp(`^${path}$`), render: () => <ShortLink to={to} /> })),
  { pattern: /^\/$/, render: () => <Home /> },
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
  { pattern: /^\/arena$/, render: () => <ArenaPage /> },
  { pattern: /^\/arena\/season$/, render: () => <SeasonPage /> },
  { pattern: /^\/arena\/season\/(S0|\d{4}-Q[1-4])$/, render: ([id]) => <SeasonPage key={id} id={id!} /> },
  { pattern: /^\/arena\/([A-Za-z0-9]{8})$/, render: ([id]) => <ArenaPage key={id} id={id!} /> },
  { pattern: /^\/racer$/, render: () => <RacerPage /> },
  { pattern: /^\/racer\/([A-Za-z0-9]{8})$/, render: ([id]) => <RacePage key={id} id={id!} /> },
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

export const NotFound = () => {
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
