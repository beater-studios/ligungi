import { Trophy } from '../../arena/Trophy.tsx';
import { RaceTrack } from '../../puzzles/RaceTrack.tsx';
import { Flag } from '../../players/Flag.tsx';
import { PlayerTag } from '../../players/PlayerTag.tsx';
import { ProfileAbout } from '../../players/ProfileAbout.tsx';
import { RatingHistoryChart } from '../../players/RatingHistoryChart.tsx';
import { Example, Section } from './parts.tsx';

export const DataSection = () => (
  <Section id="data" title="Data">
    <Example label="Race track (RaceTrack): one lane per racer, the marker as far as the score; your lane in green, ghosts faded with a hollow marker">
      <RaceTrack
        players={[
          { name: 'Ana', user: { id: 'ana', name: 'Ana' }, guest: null, score: 18, me: true },
          { name: '', user: null, guest: 4821, score: 23, me: false },
        ]}
        ghosts={[{ name: 'Bruno', user: { id: 'bruno', name: 'Bruno' }, guest: null, points: [[10_000, 6], [40_000, 15]] }]}
        elapsed={45_000}
        over={false}
      />
    </Example>
    <Example label="Rating history (RatingHistoryChart): one 2px line, a recessive grid, crosshair and tip on hover or touch">
      <RatingHistoryChart
        label="Example rating history"
        points={[1500, 1562, 1541, 1580, 1574, 1603, 1590, 1622].map((rating, i, all) => ({
          at: Date.UTC(2026, 9, 1 + i * 4),
          rating,
          change: i ? rating - all[i - 1]! : rating - 1500,
          gameId: `example${i}`,
        }))}
      />
    </Example>
    <Example label="Arena trophies (Trophy): the tower is the place (3 discs for the champion, 2 for second, 1 for third) and the top 10% a smaller blue disc; shape and color change together; sizes 72, 48, 32 and 22">
      <div class="ligungi-ds__row">
        <Trophy kind="arenaChampion" size={72} />
        <Trophy kind="arenaSecond" size={72} />
        <Trophy kind="arenaThird" size={72} />
        <Trophy kind="arenaTop" size={72} />
        <Trophy kind="arenaChampion" size={48} />
        <Trophy kind="arenaChampion" size={32} />
        <Trophy kind="arenaChampion" size={22} />
      </div>
    </Example>
    <Example label="Players (PlayerTag)">
      <div class="ligungi-ds__row">
        <PlayerTag player={{ name: 'Netero', user: { id: 'x', name: 'Netero' }, rating: 2100, ratingDiff: 8 }} />
        <PlayerTag player={{ name: 'Zeno', user: { id: 'y', name: 'Zeno' }, rating: 1950, ratingDiff: -8, provisional: true }} />
        <PlayerTag player={{ name: 'Anonymous', user: null, rating: null, ratingDiff: null }} />
      </div>
    </Example>
    <Example label="Presence (.user-link)">
      <div class="ligungi-ds__row">
        <a class="user-link online" href="#data">
          <i class="line" />
          Online
        </a>
        <a class="user-link offline" href="#data">
          <i class="line" />
          Offline
        </a>
      </div>
    </Example>
    <Example label="Flags beside names (Flag, .ligungi-flag)">
      <div class="ligungi-ds__row">
        <span>
          Gon <Flag country="br" />
        </span>
        <span>
          Killua <Flag country="jp" />
        </span>
        <span>
          Kite <Flag country="pt" />
        </span>
      </div>
    </Example>
    <Example label="Profile about: bio, social networks and profiles on other game sites (ProfileAbout)">
      <ProfileAbout details={{ bio: 'Gungi every day.\nAdvanced mode, slow games.', country: 'br', links: { youtube: 'gon', twitch: 'gon_plays', lichess: 'Gon', lishogi: 'Gon' } }} />
    </Example>
    <Example label="Tabs (.number-menu--tabs)">
      <div class="number-menu number-menu--tabs">
        <a class="nm-item active" href="#data">
          <strong>26</strong> games
        </a>
        <a class="nm-item" href="#data">
          <strong>16</strong> wins
        </a>
        <a class="nm-item" href="#data">
          <strong>5</strong> losses
        </a>
      </div>
    </Example>
    <Example label="Table (.slist)">
      <table class="slist slist-pad">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Rating</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>Netero</td>
            <td>2100</td>
          </tr>
          <tr>
            <td>2</td>
            <td>Zeno</td>
            <td>1950</td>
          </tr>
        </tbody>
      </table>
    </Example>
  </Section>
);
