import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

const MIGRATIONS = [
  `
  create table users (
    id text primary key,
    username text not null,
    username_key text not null unique,
    password_hash text not null,
    created_at integer not null
  );
  create table sessions (
    id text primary key,
    user_id text references users(id),
    created_at integer not null,
    seen_at integer not null
  );
  create table ratings (
    user_id text not null references users(id),
    mode text not null,
    rating real not null,
    deviation real not null,
    volatility real not null,
    games integer not null,
    primary key (user_id, mode)
  );
  create table games (
    id text primary key,
    mode text not null,
    rated integer not null,
    clock_initial integer,
    clock_increment integer,
    first_player text not null,
    white_session text not null,
    white_user text,
    white_name text not null,
    white_rating integer,
    white_provisional integer not null default 0,
    white_diff integer,
    black_session text not null,
    black_user text,
    black_name text not null,
    black_rating integer,
    black_provisional integer not null default 0,
    black_diff integer,
    moves text not null default '',
    status text not null,
    winner text,
    reason text,
    clock_white integer,
    clock_black integer,
    clock_running text,
    rematch_id text,
    created_at integer not null,
    ended_at integer,
    updated_at integer not null
  );
  create index games_white_user on games(white_user, created_at);
  create index games_black_user on games(black_user, created_at);
  create index games_status on games(status);
  `,
  `
  alter table games add column free_draft integer not null default 0;
  `,
  `
  create table follows (
    user_id text not null references users(id),
    followed_id text not null references users(id),
    created_at integer not null,
    primary key (user_id, followed_id)
  );
  create index follows_followed on follows(followed_id);
  create index ratings_board on ratings(mode, rating);
  `,
  `
  alter table sessions add column user_agent text;
  create index sessions_user on sessions(user_id);
  `,
  `
  alter table users add column challenge_policy text not null default 'everyone';
  `,
  `
  create index games_created on games(created_at);
  `,
  `
  alter table games add column days_per_move integer;
  alter table games add column deadline integer;
  `,
  `
  create table challenges (
    id text primary key,
    settings text not null,
    owner_session text not null,
    owner_user text,
    owner_name text not null,
    destination_user text,
    destination_name text,
    created_at integer not null,
    status text not null,
    game_id text
  );
  create index challenges_owner on challenges(owner_user);
  create index challenges_destination on challenges(destination_user);
  `,
  `
  create table seeks (
    id text primary key,
    settings text not null,
    owner_session text not null,
    owner_user text not null,
    owner_name text not null,
    created_at integer not null
  );
  create index seeks_owner on seeks(owner_user);
  `,
  `
  create table two_factor (
    user_id text primary key references users(id),
    secret text not null,
    enabled_at integer,
    last_step integer not null default 0
  );
  create table recovery_codes (
    user_id text not null references users(id),
    code_hash text not null,
    primary key (user_id, code_hash)
  );
  `,
  `
  alter table users add column role text not null default 'player';
  alter table users add column suspended_until integer;
  alter table users add column suspension_reason text;
  alter table games add column voided integer not null default 0;
  create table reports (
    id text primary key,
    reporter_id text not null references users(id),
    target_id text not null references users(id),
    game_id text,
    reason text not null,
    details text not null,
    created_at integer not null,
    status text not null default 'open',
    resolution text,
    closed_by text,
    closed_at integer
  );
  create index reports_status on reports(status, created_at);
  create index reports_target on reports(target_id);
  create table mod_log (
    id integer primary key autoincrement,
    moderator_name text not null,
    action text not null,
    target_id text,
    target_name text,
    game_id text,
    details text,
    created_at integer not null
  );
  create index mod_log_target on mod_log(target_id);
  `,
  `
  alter table games add column board_moves integer;
  `,
  `
  alter table users add column bio text not null default '';
  alter table users add column country text;
  alter table users add column links text not null default '{}';
  `,
  `
  create table mates_solved (
    user_id text not null references users(id),
    problem_id text not null,
    solved_at integer not null,
    primary key (user_id, problem_id)
  );
  `,
  `
  create table lesson_progress (
    user_id text not null references users(id),
    exercise_id text not null,
    stars integer not null,
    updated_at integer not null,
    primary key (user_id, exercise_id)
  );
  `,
  `
  create table puzzle_ratings (
    user_id text primary key references users(id),
    rating real not null,
    deviation real not null,
    volatility real not null,
    games integer not null
  );
  create table puzzle_stats (
    puzzle_id text primary key,
    rating real not null,
    deviation real not null,
    volatility real not null,
    plays integer not null,
    wins integer not null
  );
  create table puzzle_attempts (
    user_id text not null references users(id),
    puzzle_id text not null,
    win integer not null,
    rating integer,
    change integer,
    created_at integer not null,
    primary key (user_id, puzzle_id)
  );
  create index puzzle_attempts_user on puzzle_attempts(user_id, created_at);
  insert into puzzle_attempts (user_id, puzzle_id, win, rating, change, created_at)
    select user_id, problem_id, 1, null, null, solved_at from mates_solved;
  drop table mates_solved;
  `,
  `
  create table practice_progress (
    user_id text not null references users(id),
    position_id text not null,
    moves integer not null,
    updated_at integer not null,
    primary key (user_id, position_id)
  );
  `,
  `
  create table puzzle_runs (
    user_id text not null references users(id),
    kind text not null,
    score integer not null,
    created_at integer not null
  );
  create index puzzle_runs_user on puzzle_runs(user_id, kind, created_at);
  `,
  `
  alter table games add column clock_byoyomi integer;
  alter table games add column clock_periods integer;
  `,
  `
  alter table ratings add column played_at integer;
  update ratings set played_at = (
    select max(coalesce(ended_at, updated_at)) from games
    where games.rated = 1 and games.status = 'ended' and games.mode = ratings.mode
      and (games.white_user = ratings.user_id or games.black_user = ratings.user_id)
  );
  `,
  `
  create table game_bookmarks (
    user_id text not null references users(id),
    game_id text not null references games(id),
    note text not null default '',
    created_at integer not null,
    updated_at integer not null,
    primary key (user_id, game_id)
  );
  create index game_bookmarks_user on game_bookmarks(user_id, created_at);
  `,
  `
  create table studies (
    id text primary key,
    owner_id text not null references users(id),
    title text not null,
    description text not null default '',
    visibility text not null,
    hidden integer not null default 0,
    created_at integer not null,
    updated_at integer not null
  );
  create index studies_owner on studies(owner_id, updated_at);
  create index studies_listed on studies(visibility, hidden, updated_at);
  create table study_chapters (
    id text primary key,
    study_id text not null references studies(id) on delete cascade,
    position integer not null,
    name text not null,
    fen text not null,
    orientation text not null,
    tree text not null,
    created_at integer not null,
    updated_at integer not null
  );
  create index study_chapters_study on study_chapters(study_id, position);
  alter table reports add column study_id text;
  `,
  `
  alter table users add column follow_policy text not null default 'everyone';
  create table notices (
    id integer primary key autoincrement,
    user_id text not null references users(id) on delete cascade,
    kind text not null,
    actor_id text references users(id) on delete cascade,
    subject text,
    ref text,
    created_at integer not null,
    read_at integer
  );
  create index notices_user on notices(user_id, id);
  `,
  `
  create table discord_links (
    user_id text primary key references users(id) on delete cascade,
    discord_id text not null unique,
    discord_name text not null,
    access_token text not null,
    refresh_token text not null,
    expires_at integer not null,
    tier text,
    metadata text,
    paused integer not null default 0,
    linked_at integer not null,
    synced_at integer
  );
  `,
  `
  create table blocks (
    user_id text not null references users(id) on delete cascade,
    blocked_id text not null references users(id) on delete cascade,
    created_at integer not null,
    primary key (user_id, blocked_id)
  );
  create index blocks_blocked on blocks(blocked_id);
  `,
  `
  create table race_sets (
    id text primary key,
    puzzles text not null,
    public integer not null,
    created_at integer not null
  );
  create index race_sets_public on race_sets(public, created_at);
  create table race_results (
    set_id text not null references race_sets(id),
    user_id text references users(id),
    guest integer,
    score integer not null,
    points text not null,
    created_at integer not null
  );
  create index race_results_set on race_results(set_id);
  create index race_results_user on race_results(user_id, created_at);
  `,
  `
  alter table reports add column chapter_id text;
  alter table reports add column chapter_path text;
  `,
  `
  create table study_likes (
    user_id text not null references users(id),
    study_id text not null references studies(id) on delete cascade,
    created_at integer not null,
    primary key (user_id, study_id)
  );
  create index study_likes_study on study_likes(study_id);
  `,
  `
  alter table games add column draft_queue text;
  `,
  `
  alter table studies add column topics text not null default '';
  `,
  `
  create table arenas (
    id text primary key,
    status text not null,
    mode text not null,
    clock_initial integer not null,
    clock_increment integer not null,
    duration integer not null,
    min_players integer not null,
    starts_at integer not null,
    started_at integer,
    finished_at integer,
    season text not null,
    announced integer not null default 0,
    reminded integer not null default 0,
    created_at integer not null
  );
  create index arenas_status on arenas(status, starts_at);
  create table arena_players (
    arena_id text not null references arenas(id),
    user_id text not null references users(id),
    rating integer not null,
    score integer not null default 0,
    games integer not null default 0,
    wins integer not null default 0,
    losses integer not null default 0,
    streak integer not null default 0,
    drew integer not null default 0,
    paused integer not null default 0,
    rank integer,
    scored_at integer not null,
    joined_at integer not null,
    primary key (arena_id, user_id)
  );
  create index arena_players_user on arena_players(user_id);
  create table arena_pairings (
    game_id text primary key,
    arena_id text not null references arenas(id),
    white_user text,
    black_user text,
    white_rating integer not null,
    black_rating integer not null,
    status text not null,
    winner text,
    white_points integer,
    black_points integer,
    white_doubled integer not null default 0,
    black_doubled integer not null default 0,
    counted integer not null default 0,
    created_at integer not null,
    ended_at integer
  );
  create index arena_pairings_arena on arena_pairings(arena_id, created_at);
  create table trophies (
    id integer primary key,
    user_id text not null references users(id),
    kind text not null,
    arena_id text not null references arenas(id),
    place integer not null,
    players integer not null,
    season text not null,
    created_at integer not null
  );
  create index trophies_user on trophies(user_id, created_at);
  alter table games add column arena_id text;
  `,
  `
  alter table games add column berserk text;
  alter table arena_pairings add column white_berserk integer not null default 0;
  alter table arena_pairings add column black_berserk integer not null default 0;
  create table arena_seasons (
    season text primary key,
    champion_id text,
    players integer not null,
    awarded_at integer not null
  );
  `,
];

export const openDatabase = (path: string): Db => {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('pragma journal_mode = wal; pragma foreign_keys = on;');
  const { user_version: version } = db.prepare('pragma user_version').get() as { user_version: number };
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.exec('begin');
    db.exec(MIGRATIONS[i]!);
    db.exec(`pragma user_version = ${i + 1}`);
    db.exec('commit');
  }
  return db;
};
