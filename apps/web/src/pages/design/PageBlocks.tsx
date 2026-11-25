import { ActivityHubView } from '../../discord/Hub.tsx';
import { Example, Section } from './parts.tsx';

export const PageBlocksSection = () => (
  <Section id="pages" title="Page blocks" note="The redesigned pages (profile first) are built from these: a ligungi-page main, ligungi-card boxes, segmented tabs and chips.">
    <Example label="Card with avatar (.ligungi-card, .ligungi-avatar)">
      <div class="ligungi-card ligungi-ds__row" style={{ padding: '1rem' }}>
        <span class="ligungi-avatar" aria-hidden="true">
          K
        </span>
        <span class="ligungi-avatar ligungi-avatar--online" aria-hidden="true">
          M
        </span>
        <span>A box on the page background, with the shadow and corners of every card.</span>
      </div>
    </Example>
    <Example label="Tabs (.ligungi-segmented) and chips (.ligungi-chip)">
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <nav class="ligungi-segmented" aria-label="Example tabs">
          <a class="active" href="#pages">
            All <strong>52</strong>
          </a>
          <a href="#pages">
            Rated <strong>38</strong>
          </a>
          <a href="#pages">
            Wins <strong>29</strong>
          </a>
        </nav>
        <nav class="ligungi-chips" aria-label="Example chips">
          <a class="ligungi-chip active" href="#pages">
            All modes
          </a>
          <a class="ligungi-chip" href="#pages">
            Advanced
          </a>
        </nav>
      </div>
    </Example>
    <Example label="Results table (.ligungi-search-table): a header row, then one link per row, every other one shaded; on phones the columns fold into two lines (game search)">
      <div class="ligungi-card" style={{ width: '100%', overflow: 'hidden' }}>
        <div class="ligungi-search-table__head" aria-hidden="true">
          <span>Players</span>
          <span>Result</span>
          <span>Mode and pace</span>
          <span class="ligungi-search-table__moves">Moves</span>
          <span class="ligungi-search-table__date">Date</span>
        </div>
        <ul class="ligungi-search-table">
          {[
            ['Mira (1580) × tenzo (1502)', 'White wins', 'resignation', 'Advanced · 10+5 · Rated', 131],
            ['kaiq (1577) × Rafa (1490)', 'Draw', 'repetition', 'Beginner · 3 days per move · Casual', 64],
          ].map(([players, result, how, mode, moves]) => (
            <li key={String(players)}>
              <a class="ligungi-search-table__row" href="#pages">
                <span class="ligungi-search-table__players">{players}</span>
                <span class="ligungi-search-table__result">
                  {result}
                  <small>{how}</small>
                </span>
                <span class="ligungi-search-table__mode">{mode}</span>
                <span class="ligungi-search-table__moves">{moves}</span>
                <span class="ligungi-search-table__date">Nov 20, 2026</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Example>
    <Example label="Live badge (.ligungi-live-badge)">
      <span class="ligungi-live-badge">Live</span>
    </Example>
    <Example label="Game row (.ligungi-game-row)">
      <ul class="ligungi-game-list" style={{ padding: 0 }}>
        <li>
          <a class="ligungi-game-row ligungi-game-row--win" href="#pages">
            <span class="ligungi-game-row__result">Win</span>
            <span class="ligungi-game-row__main">
              <span class="ligungi-game-row__opponent">
                vs Netero <span class="ligungi-game-row__rating">2100</span>
              </span>
              <span class="ligungi-game-row__meta">Advanced · 10+5 · Rated · checkmate · 64 moves</span>
            </span>
            <span class="ligungi-game-row__diff">+11</span>
            <span class="ligungi-game-row__date">Nov 13, 2026</span>
          </a>
        </li>
      </ul>
    </Example>
    <Example label="Quick pairing (.ligungi-pools, .ligungi-pool)">
      <div class="ligungi-pools" style={{ maxWidth: '30rem' }}>
        <button type="button" class="ligungi-pool">
          <span class="ligungi-pool__clock">10+5</span>
          <span class="ligungi-pool__kind">Rated</span>
          <span class="ligungi-pool__waiting is-waiting">2 waiting</span>
        </button>
        <button type="button" class="ligungi-pool">
          <span class="ligungi-pool__clock">30+20</span>
          <span class="ligungi-pool__kind">Rated</span>
          <span class="ligungi-pool__waiting">nobody waiting</span>
        </button>
      </div>
    </Example>
    <Example label="Open game row (.ligungi-seek)">
      <ul class="ligungi-card ligungi-seeks">
        <li class="ligungi-seek">
          <span class="ligungi-seek__player">
            <span class="is is2 color-icon random" />
            <span class="ligungi-seek__name">Netero</span>
            <span class="ligungi-seek__rating">2100</span>
          </span>
          <span class="ligungi-seek__time">15+10</span>
          <span class="ligungi-seek__mode">Advanced</span>
          <span class="ligungi-seek__kind">Rated</span>
          <span class="ligungi-seek__meta">Advanced · 15+10 · Rated</span>
          <button type="button" class="button ligungi-button-good ligungi-seek__action">
            Join
          </button>
        </li>
      </ul>
    </Example>
    <Example label="Game in progress (.ligungi-live-strip)">
      <section class="ligungi-card ligungi-live-strip">
        <span class="ligungi-live-badge">Your game</span>
        <span class="ligungi-live-strip__text">Gon × Killua · Advanced · 10+5</span>
        <a class="button" href="#pages">
          Back to the game
        </a>
      </section>
    </Example>
    <Example label="Ranking rows with medals and the viewer's row (.ligungi-ranking-row)">
      <ol class="ligungi-card ligungi-ranking-list">
        <li class="ligungi-ranking-row">
          <span class="ligungi-ranking-row__rank ligungi-ranking-row__rank--1">1</span>
          <span class="ligungi-ranking-row__player">
            <a class="user-link online" href="#pages">
              <i class="line" />
              Netero
            </a>
          </span>
          <strong class="ligungi-ranking-row__rating">2100</strong>
          <span class="ligungi-ranking-row__games">40</span>
          <span class="ligungi-ranking-row__record">
            <span class="ligungi-ranking-row__win">25</span> · 3 · <span class="ligungi-ranking-row__loss">12</span>
          </span>
          <span class="ligungi-ranking-row__meta">40 games · 25 W · 3 D · 12 L</span>
        </li>
        <li class="ligungi-ranking-row ligungi-ranking-row--me">
          <span class="ligungi-ranking-row__rank">27</span>
          <span class="ligungi-ranking-row__player">
            <a class="user-link offline" href="#pages">
              <i class="line" />
              Gon
            </a>
            <span class="ligungi-tag">you</span>
          </span>
          <strong class="ligungi-ranking-row__rating">1580</strong>
          <span class="ligungi-ranking-row__games">15</span>
          <span class="ligungi-ranking-row__record">
            <span class="ligungi-ranking-row__win">9</span> · 2 · <span class="ligungi-ranking-row__loss">4</span>
          </span>
          <span class="ligungi-ranking-row__meta">15 games · 9 W · 2 D · 4 L</span>
        </li>
      </ol>
    </Example>
    <Example label="Pagination (.ligungi-ranking-pages)">
      <nav class="ligungi-ranking-pages" aria-label="Pages" style={{ marginInlineStart: 0 }}>
        <button type="button" class="ligungi-ranking-pages__step" disabled>
          Previous
        </button>
        <button type="button" class="ligungi-ranking-pages__number active" aria-current="page">
          1
        </button>
        <button type="button" class="ligungi-ranking-pages__number">2</button>
        <span class="ligungi-ranking-pages__gap">…</span>
        <button type="button" class="ligungi-ranking-pages__number">9</button>
        <button type="button" class="ligungi-ranking-pages__step">Next</button>
      </nav>
    </Example>
    <Example label="Discord hub (ActivityHubView): the home page inside the Discord Activity, with who is in the call, a form to open a room and the call's rooms and games">
      <ActivityHubView
        state={{ status: 'ready', instanceId: 'design', reason: 'unlinked' }}
        people={[
          { id: '1', name: 'Ana', avatar: null },
          { id: '2', name: 'Bruno', avatar: null },
          { id: '3', name: 'Carla', avatar: null },
        ]}
        hall={{
          rooms: [
            {
              challengeId: 'design1',
              settings: { mode: 'beginner', rated: false, timeControl: { initial: 600, increment: 5 }, daysPerMove: null, color: 'random', freeDraft: false },
              challenger: { name: 'Ana', user: { id: 'ana', name: 'Ana' }, rating: 1512 },
              mine: false,
            },
            {
              challengeId: 'design2',
              settings: { mode: 'advanced', rated: false, timeControl: { initial: 300, increment: 3 }, daysPerMove: null, color: 'white', freeDraft: false },
              challenger: { name: '', user: null, rating: null },
              mine: true,
            },
          ],
          games: [
            {
              id: 'design3',
              mode: 'intermediate',
              rated: false,
              timeControl: { initial: 600, increment: 5 },
              players: {
                white: { name: 'Bruno', user: { id: 'bruno', name: 'Bruno' }, rating: 1480, ratingDiff: null },
                black: { name: 'Carla', user: { id: 'carla', name: 'Carla' }, rating: 1530, ratingDiff: null },
              },
              status: 'started',
              outcome: null,
              plies: 14,
              fen: '',
              createdAt: 0,
              endedAt: null,
              clock: null,
              daysPerMove: null,
              deadlineIn: null,
              turn: 'white',
              voided: false,
            },
          ],
          race: { id: 'design4', status: 'waiting', players: 2 },
        }}
        onOpen={async () => undefined}
        onJoin={async () => undefined}
        onClose={async () => undefined}
        onInvite={() => undefined}
        onRace={async () => undefined}
      />
    </Example>
  </Section>
);
