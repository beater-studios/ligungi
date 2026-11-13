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
