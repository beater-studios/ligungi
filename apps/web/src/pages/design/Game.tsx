import { initialPosition, legalMoves, parseFen, parseSquare } from '@ligungi/engine';
import { FeedList } from '../../players/ActivityFeed.tsx';
import { TowerStrip } from '../../components/Panels.tsx';
import { BlindPanel } from '../../blind/BlindPanel.tsx';
import { BoardView } from '../../components/BoardView.tsx';
import { CrosstableView } from '../../game/Crosstable.tsx';
import { KeyboardMove } from '../../game/KeyboardMove.tsx';
import { RatingTrend } from '../../players/RatingTrend.tsx';
import { MiniBoard } from '../../components/MiniBoard.tsx';
import { Stars } from '../../learn/Stars.tsx';
import { icons } from '../../icons.ts';
import { ResultBar } from '../../components/ResultBar.tsx';
import { Records } from '../../puzzles/Records.tsx';
import { Example, Section } from './parts.tsx';

const lessonPosition = parseFen('9/9/9/9/9/9/4P4/4S4/9 w - advanced p w');

export const GameSection = () => (
  <Section id="game" title="Game">
    <Example label="Pieces (.gg-mini-piece)">
      <div class="ligungi-ds__row gg-palette">
        <span class="gg-mini-piece white">
          <span>帥</span>
        </span>
        <span class="gg-mini-piece black">
          <span>帥</span>
        </span>
      </div>
    </Example>
    <Example label="Piece looks: the page root's gg-shape-koma, gg-pieces-<palette> and ligungi-kanji-<font> classes restyle every piece; here set locally">
      <div class="ligungi-ds__row">
        <span class="gg-palette gg-pieces-lacquer ligungi-kanji-gothic ligungi-ds__row">
          <span class="gg-mini-piece white">
            <span>帥</span>
          </span>
          <span class="gg-mini-piece black">
            <span>帥</span>
          </span>
        </span>
        <span class="gg-shape-koma gg-palette gg-pieces-wood ligungi-kanji-brush ligungi-ds__row">
          <span class="gg-mini-piece white">
            <span>帥</span>
          </span>
          <span class="gg-mini-piece black flipped">
            <span>帥</span>
          </span>
        </span>
        <span class="ligungi-font-sample ligungi-font-sample--pop">帥</span>
        <span class="ligungi-swatch">
          <i style={{ background: '#d9a27c' }} />
          <i style={{ background: '#2b211c' }} />
        </span>
      </div>
    </Example>
    <Example label="Static board (MiniBoard)">
      <div class="ligungi-ds__board">
        <MiniBoard position={initialPosition('intro')} />
      </div>
    </Example>
    <Example label="Lesson stars (Stars, .ligungi-stars) and a stage card of the lessons map (.ligungi-lesson-stage)">
      <div class="ligungi-ds__row">
        <Stars filled={3} label="3 of 3" />
        <Stars filled={2} label="2 of 3" />
        <Stars filled={0} label="0 of 3" />
      </div>
      <a class="ligungi-card ligungi-lesson-stage" href="#game" style={{ maxWidth: '18rem', marginTop: '1rem' }}>
        <span class="ligungi-lesson-stage__number">Stage 2</span>
        <strong class="ligungi-lesson-stage__title">Towers</strong>
        <span class="ligungi-lesson-stage__intro">A piece can climb onto another instead of going to an empty square.</span>
        <span class="ligungi-lesson-stage__dots" aria-hidden="true">
          <i class="is-3" />
          <i class="is-2" />
          <i class="is-0" />
        </span>
      </a>
    </Example>
    <Example label="Round timer of the coordinate trainer (.ligungi-coords__time)">
      <div class="ligungi-coords__time" style={{ maxWidth: '16rem' }}>
        <span style={{ width: '60%' }} />
      </div>
    </Example>
    <Example label="Practice position card, with the done mark (.ligungi-practice__position)">
      <a class="ligungi-card ligungi-practice__position" href="#game" style={{ maxWidth: '14rem' }}>
        <MiniBoard position={lessonPosition} />
        <strong>General and two Samurai</strong>
        <span>Mate within 20 moves</span>
        <span class="ligungi-tag ligungi-practice__done" data-icon={icons.Checkmark}>
          Done in 12 moves
        </span>
      </a>
    </Example>
    <Example label="Puzzle rating change (.ligungi-puzzle__change) and a share bar of the puzzle dashboard (.ligungi-puzzle-dashboard__bar)">
      <p class="ligungi-puzzle__change is-up">Puzzle rating: 1557 (+57)</p>
      <p class="ligungi-puzzle__change is-down">Puzzle rating: 1490 (-12)</p>
      <span class="ligungi-puzzle-dashboard__bar" style={{ '--rate': '64%', maxWidth: '16rem' }}>
        64%
      </span>
    </Example>
    <Example label="Puzzle Storm card: clock with a time bonus, score, combo toward the next bonus and records (.ligungi-run)">
      <section class="ligungi-card ligungi-game-info ligungi-run" style={{ maxWidth: '18rem' }}>
        <div class="ligungi-run__clock">
          <span class="ligungi-run__time">2:41</span>
          <span class="ligungi-run__flash is-good" style={{ animation: 'none' }}>
            +5s
          </span>
          <span class="ligungi-run__bar">
            <span style={{ width: '89%' }} />
          </span>
        </div>
        <p class="ligungi-run__score">
          <strong>9</strong>
          <span>Solved</span>
        </p>
        <div class="ligungi-run__combo">
          <span>
            Combo <strong>14</strong>
          </span>
          <span class="ligungi-run__bar is-combo">
            <span style={{ width: '25%' }} />
          </span>
        </div>
        <Records records={{ today: 9, week: 14, ever: 21 }} />
      </section>
    </Example>
    <Example label="Results of the draft explorer: White wins, draws and Black wins (.ligungi-explorer__bar)">
      <div style={{ maxWidth: '16rem' }}>
        <ResultBar stats={{ games: 20, white: 9, draws: 3, black: 8, rating: 1600 }} />
      </div>
    </Example>
    <Example label="Goal stars on the board (the board's targets option), on empty squares and above a piece">
      <div class="ligungi-ds__board">
        <BoardView position={lessonPosition} orientation="white" targets={[parseSquare('e5')!, parseSquare('e3')!]} />
      </div>
    </Example>
    <Example label="Typed moves under the board (KeyboardMove, Settings > Preferences > Type moves): here from the Beginner start, try 6-8 general">
      <div style={{ maxWidth: '24rem' }}>
        <KeyboardMove position={initialPosition('beginner')} legal={legalMoves(initialPosition('beginner'))} live onMove={() => undefined} onLive={() => undefined} />
      </div>
    </Example>
    <Example label="Home cards: the leaders, one row per mode (.ligungi-home__leaders), and a signed-in player's training links (.ligungi-home__training)">
      <section class="ligungi-card ligungi-home__leaders" style={{ maxWidth: '34rem' }}>
        <div class="ligungi-home__card-head">
          <h2>Top players</h2>
          <a href="#game">Leaderboard</a>
        </div>
        <ul>
          {[
            ['Advanced', 'shogun42', 1712, true],
            ['Advanced', 'torre_alta', 1688, false],
            ['Beginner', 'kanji_fan', 1602, true],
            ['Beginner', 'ronin7', 1580, false],
          ].map(([mode, name, rating, online]) => (
            <li key={String(name)}>
              <span class="ligungi-home__leader">
                <a class="ligungi-home__leader-mode" href="#game">
                  {mode}
                </a>
                <a class={`user-link${online ? ' online' : ''}`} href="#game">
                  <i class="line" />
                  {name}
                </a>
              </span>
              <strong>{rating}</strong>
            </li>
          ))}
        </ul>
      </section>
      <section class="ligungi-card ligungi-home__training" style={{ maxWidth: '18rem' }}>
        <h2>Train</h2>
        <ul>
          {[
            ['Puzzle rating', '1532'],
            ['Puzzle Storm, best', '18'],
            ['Puzzle Streak, best', '9'],
            ['Lessons', '6 of 8 stages'],
          ].map(([label, value]) => (
            <li key={label}>
              <a href="#game">
                <span>{label}</span>
                <strong>{value}</strong>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </Example>
    <Example label="Rating trend beside a rating (players/RatingTrend.tsx): the change over the last 7 days, nothing when it did not move">
      <span style={{ display: 'flex', gap: '1.5rem' }}>
        <span>
          <strong>1712</strong> <RatingTrend value={24} />
        </span>
        <span>
          <strong>1688</strong> <RatingTrend value={-9} />
        </span>
      </span>
    </Example>
    <Example label="Head to head between two players (game/Crosstable.tsx): score, draws and the latest results from the first player's side">
      <div style={{ maxWidth: '20rem', width: '100%' }}>
        <CrosstableView
          data={{
            users: [
              { id: 'a', name: 'shogun42' },
              { id: 'b', name: 'torre_alta' },
            ],
            wins: [5, 3],
            draws: 1,
            recent: [
              { id: 'g1', winner: 0 },
              { id: 'g2', winner: 1 },
              { id: 'g3', winner: null },
              { id: 'g4', winner: 0 },
              { id: 'g5', winner: 0 },
            ],
          }}
          allHref="#game"
        />
      </div>
    </Example>
    <Example label="TV channel list, beside the watched game (.ligungi-tv-channels)">
      <nav class="ligungi-card ligungi-tv-channels" aria-label="Channels" style={{ maxWidth: '16rem' }}>
        <a class="ligungi-tv-channel active" href="#game" aria-current="page">
          <strong>Top rated</strong>
          <span>Netero × Meruem</span>
        </a>
        <a class="ligungi-tv-channel" href="#game">
          <strong>Advanced</strong>
          <span>Gon × Killua</span>
        </a>
        <a class="ligungi-tv-channel" href="#game">
          <strong>Introductory</strong>
          <span>No games right now</span>
        </a>
      </nav>
    </Example>
    <Example label="Study card in the list (.ligungi-studies__card): text only, never a board">
      <ul class="ligungi-studies__list" style={{ maxWidth: '20rem', width: '100%' }}>
        <li>
          <a class="ligungi-studies__card" href="#game">
            <strong class="ligungi-studies__name">Draft: protecting the Marshal</strong>
            <span class="ligungi-studies__description">Four ways to build the Marshal's defense in the draft.</span>
            <span class="ligungi-studies__meta">
              <span>4 chapters</span>
              <span>by marechal_br</span>
              <span>2 h ago</span>
            </span>
          </a>
        </li>
      </ul>
    </Example>
    <Example label="Drawings on the board (board shapes), the limit message over the board (.ligungi-study__toast) and the study's drawing tools (.ligungi-study__draw): up to 8 arrows and 8 painted squares per move">
      <div class="ligungi-study" style={{ display: 'grid', gap: '0.75rem', width: '100%', maxWidth: '22rem' }}>
        <div style={{ width: '100%', position: 'relative' }}>
          <BoardView
            position={initialPosition('intro')}
            orientation="white"
            shapes={[
              { kind: 'arrow', from: parseSquare('e3')!, to: parseSquare('e5')!, color: 'green' },
              { kind: 'square', square: parseSquare('e5')!, color: 'red' },
              { kind: 'square', square: parseSquare('d5')!, color: 'blue' },
            ]}
          />
          <p class="ligungi-study__toast" role="status">
            Each move has up to 8 arrows and 8 painted squares. Erase one to draw another.
          </p>
        </div>
        <div class="ligungi-study__draw" role="group" aria-label="Draw">
          <span class="ligungi-study__draw-label">Draw</span>
          {(['green', 'red', 'blue', 'orange'] as const).map((brush, i) => (
            <button key={brush} type="button" class={`ligungi-study__swatch gg-brush-${brush}`} aria-pressed={i === 0} aria-label={brush} title={brush} />
          ))}
          <span class="ligungi-study__count">Arrows 1 of 2 · Squares 2 of 4</span>
        </div>
        <p class="ligungi-study__comment">A comment on the current move, as readers see it under the board.</p>
      </div>
    </Example>
    <Example label="Tower on tap, on a phone (the towerTap preference): the strip under the board (TowerStrip, .ligungi-tower-strip), empty and with a tower. The balloon choice is the board's own floating panel (inspector and inspectSelection)">
      <div style={{ display: 'grid', gap: '0.75rem', width: '100%', maxWidth: '24rem' }}>
        <TowerStrip position={initialPosition('intro')} square={null} />
        <TowerStrip
          position={parseFen('4m4/9/9/9/4(Psp)4/9/9/9/4M4 w - advanced p w')}
          square={parseSquare('e5')!}
        />
      </div>
    </Example>
    <Example label="Activity (.ligungi-activity, one day of the profile's last 30) and the feed of followed players (FeedList, home and friends page)">
      <div style={{ display: 'grid', gap: '1rem', width: '100%', maxWidth: '34rem' }}>
        <section class="ligungi-card ligungi-activity">
          <header class="ligungi-activity__head">
            <h2>Activity</h2>
            <span class="ligungi-activity__intro">The last 30 days.</span>
          </header>
          <ol class="ligungi-activity__days">
            <li class="ligungi-activity__day">
              <h3>Nov 17, 2026</h3>
              <ul class="ligungi-activity__items">
                <li class="ligungi-activity__item is-games">
                  3 Advanced games: 2 wins, 1 loss<span class="ligungi-activity__diff is-up"> +14</span>
                </li>
                <li class="ligungi-activity__item is-study">
                  Created the study <a href="/study">Draft: protecting the Marshal</a>
                </li>
                <li class="ligungi-activity__item is-training">Solved 7 of 9 puzzles</li>
              </ul>
            </li>
          </ol>
        </section>
        <section class="ligungi-card ligungi-home__feed">
          <div class="ligungi-home__card-head">
            <h2>People you follow</h2>
            <a href="/friends">See all</a>
          </div>
          <FeedList
            items={[
              {
                user: { id: 'a', name: 'marechal_br' },
                event: {
                  kind: 'game',
                  at: Date.now() - 600_000,
                  game: { id: 'abcd1234', mode: 'advanced', rated: true, color: 'white', result: 'win', reason: 'mate', ratingDiff: 9, opponent: { name: 'kanji_fan', user: null } },
                },
              },
              { user: { id: 'b', name: 'torre_alta' }, event: { kind: 'study', at: Date.now() - 7_200_000, study: { id: 'efgh5678', title: 'Endgames with the Fortress' } } },
            ]}
          />
        </section>
      </div>
    </Example>
    <Example label="Screen reader mode (BlindPanel, .ligungi-blind): the game as text under the board, with the command field and the live log of announcements (role=log). Type p, c 4-7 or 6-6 samurai here; this sample has no moves to play">
      <div style={{ width: '100%', maxWidth: '34rem' }}>
        <BlindPanel
          position={initialPosition('beginner')}
          legal={[]}
          positions={[initialPosition('beginner')]}
          moves={[]}
          live
          names={{ white: 'marechal_br', black: 'kanji_fan' }}
          autoFocus={false}
        />
      </div>
    </Example>
  </Section>
);
