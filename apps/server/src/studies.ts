import { MODES, type Color, type Mode } from '@ligungi/engine';
import {
  DAY_MS,
  STUDY_LIST_PAGE,
  STUDY_PUBLIC_MIN_DAYS,
  type StudyChapter,
  type StudyChapterRef,
  type StudyLikes,
  type StudyListItem,
  type StudyRoot,
  type StudySort,
  type StudyTopic,
  type StudyView,
  type StudyVisibility,
} from '@ligungi/protocol';
import type { Db } from './db.ts';
import { randomId } from './ids.ts';

interface StudyRow {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_created_at: number;
  title: string;
  description: string;
  visibility: StudyVisibility;
  hidden: number;
  created_at: number;
  updated_at: number;
  chapters: number;
  likes: number;
  topics: string;
  /** The chapters' starting positions, joined with `|`. */
  fens: string | null;
}

interface ChapterRow {
  id: string;
  name: string;
  fen: string;
  orientation: Color;
  tree: string;
}

export interface StudyRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly ownerName: string;
  /** When the author's account was created: its public studies join the list `STUDY_PUBLIC_MIN_DAYS` later. */
  readonly ownerCreatedAt: number;
  readonly title: string;
  readonly description: string;
  readonly visibility: StudyVisibility;
  readonly hidden: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly chapters: number;
  readonly likes: number;
  readonly topics: readonly StudyTopic[];
  readonly modes: readonly Mode[];
}

/** Narrows the public list: chapters in a mode, a topic, an author. */
export interface StudyFilters {
  readonly mode?: Mode;
  readonly topic?: StudyTopic;
  readonly ownerId?: string;
}

export interface ChapterInput {
  readonly name: string;
  readonly fen: string;
  readonly orientation: Color;
  readonly root: StudyRoot;
}

const STUDY_SELECT = `select studies.*, users.username as owner_name, users.created_at as owner_created_at,
    (select count(*) from study_chapters where study_chapters.study_id = studies.id) as chapters,
    (select count(*) from study_likes where study_likes.study_id = studies.id) as likes,
    (select group_concat(fen, '|') from study_chapters where study_chapters.study_id = studies.id) as fens
  from studies join users on users.id = studies.owner_id`;

/** The mode of each chapter's starting position, the fourth field of its FEN, in the order of `MODES`. */
const modesOf = (fens: string | null): Mode[] => {
  const found = new Set((fens ?? '').split('|').map((fen) => fen.split(' ')[3]));
  return MODES.filter((mode) => found.has(mode));
};

const toRecord = (row: StudyRow): StudyRecord => ({
  id: row.id,
  ownerId: row.owner_id,
  ownerName: row.owner_name,
  ownerCreatedAt: row.owner_created_at,
  title: row.title,
  description: row.description,
  visibility: row.visibility,
  hidden: row.hidden === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  chapters: row.chapters,
  likes: row.likes,
  topics: row.topics ? (row.topics.split(',') as StudyTopic[]) : [],
  modes: modesOf(row.fens),
});

/** When a public study joins the public list, if that is still ahead of `now`. */
const listedFromOf = (study: StudyRecord, now: number): number | null => {
  const from = study.ownerCreatedAt + STUDY_PUBLIC_MIN_DAYS * DAY_MS;
  return study.visibility === 'public' && from > now ? from : null;
};

const toItem = (study: StudyRecord, listedFrom: number | null = null): StudyListItem => ({
  id: study.id,
  title: study.title,
  description: study.description,
  owner: { id: study.ownerId, name: study.ownerName },
  visibility: study.visibility,
  hidden: study.hidden,
  chapters: study.chapters,
  likes: study.likes,
  updatedAt: study.updatedAt,
  topics: study.topics,
  modes: study.modes,
  listedFrom,
});

const toChapter = (row: ChapterRow): StudyChapter => ({
  id: row.id,
  name: row.name,
  fen: row.fen,
  orientation: row.orientation,
  root: JSON.parse(row.tree) as StudyRoot,
});

/** Studies: chapters of commented moves with variations and drawings, written by one author. */
export class Studies {
  readonly #db: Db;
  readonly #now: () => number;

  constructor(db: Db, now: () => number) {
    this.#db = db;
    this.#now = now;
  }

  get(id: string): StudyRecord | undefined {
    const row = this.#db.prepare(`${STUDY_SELECT} where studies.id = ?`).get(id) as StudyRow | undefined;
    return row && toRecord(row);
  }

  /**
   * Whether a viewer may open the study: its author always, nobody else a private one, the moderators a hidden one and
   * everyone the rest.
   */
  canRead(study: StudyRecord, viewerId: string | null, moderator: boolean): boolean {
    if (study.ownerId === viewerId) return true;
    if (study.visibility === 'private') return false;
    return moderator || !study.hidden;
  }

  view(study: StudyRecord, viewerId: string | null): StudyView {
    const chapters = this.#db
      .prepare('select id, name from study_chapters where study_id = ? order by position')
      .all(study.id) as unknown as StudyChapterRef[];
    return {
      id: study.id,
      title: study.title,
      description: study.description,
      visibility: study.visibility,
      owner: { id: study.ownerId, name: study.ownerName },
      hidden: study.hidden,
      createdAt: study.createdAt,
      updatedAt: study.updatedAt,
      chapters: chapters.map(({ id, name }) => ({ id, name })),
      mine: study.ownerId === viewerId,
      likes: study.likes,
      liked: viewerId !== null && this.#likes(viewerId, study.id),
      topics: study.topics,
      modes: study.modes,
      listedFrom: study.ownerId === viewerId ? listedFromOf(study, this.#now()) : null,
    };
  }

  /**
   * Public studies, latest changed first or most liked first, optionally whose title contains `query`, with a chapter
   * in a mode, about a topic or by an author. An account younger than `STUDY_PUBLIC_MIN_DAYS` may publish, but its
   * public studies only join the list once it is that old; listed by author (its profile), they show at once.
   */
  listed(query: string, page: number, sort: StudySort = 'updated', filters: StudyFilters = {}): { studies: StudyListItem[]; more: boolean } {
    const order = sort === 'liked' ? 'likes desc, studies.updated_at desc, studies.rowid desc' : 'studies.updated_at desc, studies.rowid desc';
    const rows = this.#db
      .prepare(
        `${STUDY_SELECT} where studies.visibility = 'public' and studies.hidden = 0 and (?1 = '' or instr(lower(studies.title), lower(?1)) > 0)
           and (?4 = '' or exists (select 1 from study_chapters where study_chapters.study_id = studies.id and study_chapters.fen like '% ' || ?4 || ' %'))
           and (?5 = '' or instr(',' || studies.topics || ',', ',' || ?5 || ',') > 0)
           and (?6 = '' or studies.owner_id = ?6)
           and (?6 != '' or users.created_at <= ?7)
         order by ${order} limit ?2 offset ?3`,
      )
      .all(
        query,
        STUDY_LIST_PAGE + 1,
        (page - 1) * STUDY_LIST_PAGE,
        filters.mode ?? '',
        filters.topic ?? '',
        filters.ownerId ?? '',
        this.#now() - STUDY_PUBLIC_MIN_DAYS * DAY_MS,
      ) as unknown as StudyRow[];
    return { studies: rows.slice(0, STUDY_LIST_PAGE).map((row) => toItem(toRecord(row))), more: rows.length > STUDY_LIST_PAGE };
  }

  /** Every study of an author, whatever its visibility, for the author: with when the public ones join the list. */
  byOwner(ownerId: string, query = ''): StudyListItem[] {
    const rows = this.#db
      .prepare(
        `${STUDY_SELECT} where studies.owner_id = ?1 and (?2 = '' or instr(lower(studies.title), lower(?2)) > 0)
         order by studies.updated_at desc, studies.rowid desc`,
      )
      .all(ownerId, query) as unknown as StudyRow[];
    const now = this.#now();
    return rows.map((row) => {
      const study = toRecord(row);
      return toItem(study, listedFromOf(study, now));
    });
  }

  /**
   * The studies a player likes that they can still open (their own, or any other neither private nor hidden), latest
   * liked first, optionally whose title contains `query`.
   */
  likedBy(userId: string, query = ''): StudyListItem[] {
    const rows = this.#db
      .prepare(
        `${STUDY_SELECT} join study_likes on study_likes.study_id = studies.id and study_likes.user_id = ?1
         where (studies.owner_id = ?1 or (studies.visibility != 'private' and studies.hidden = 0)) and (?2 = '' or instr(lower(studies.title), lower(?2)) > 0)
         order by study_likes.created_at desc, study_likes.rowid desc`,
      )
      .all(userId, query) as unknown as StudyRow[];
    return rows.map((row) => toItem(toRecord(row)));
  }

  /** Likes a study, or takes the like back; one like per player and study. */
  setLiked(userId: string, studyId: string, liked: boolean): StudyLikes {
    if (liked) this.#db.prepare('insert or ignore into study_likes (user_id, study_id, created_at) values (?, ?, ?)').run(userId, studyId, this.#now());
    else this.#db.prepare('delete from study_likes where user_id = ? and study_id = ?').run(userId, studyId);
    const { n } = this.#db.prepare('select count(*) as n from study_likes where study_id = ?').get(studyId) as { n: number };
    return { likes: n, liked };
  }

  /** Every like of a player, for their data export. */
  likesBy(userId: string): Array<{ studyId: string; at: number }> {
    return (
      this.#db.prepare('select study_id, created_at from study_likes where user_id = ? order by created_at').all(userId) as Array<{ study_id: string; created_at: number }>
    ).map((row) => ({ studyId: row.study_id, at: row.created_at }));
  }

  /** Public studies, not hidden, created since a moment by some authors, newest first (activity and feed). */
  createdBy(ownerIds: readonly string[], since: number, limit: number): Array<{ ownerId: string; ownerName: string; id: string; title: string; at: number }> {
    if (ownerIds.length === 0) return [];
    const rows = this.#db
      .prepare(
        `${STUDY_SELECT} where studies.owner_id in (${ownerIds.map(() => '?').join(', ')}) and studies.visibility = 'public' and studies.hidden = 0
           and studies.created_at >= ? order by studies.created_at desc limit ?`,
      )
      .all(...ownerIds, since, limit) as unknown as StudyRow[];
    return rows.map((row) => ({ ownerId: row.owner_id, ownerName: row.owner_name, id: row.id, title: row.title, at: row.created_at }));
  }

  count(ownerId: string): number {
    return (this.#db.prepare('select count(*) as n from studies where owner_id = ?').get(ownerId) as { n: number }).n;
  }

  create(ownerId: string, title: string, description: string, visibility: StudyVisibility, topics: readonly StudyTopic[], chapter: ChapterInput): string {
    const id = randomId(8);
    const now = this.#now();
    this.#db.exec('begin');
    try {
      this.#db
        .prepare('insert into studies (id, owner_id, title, description, visibility, topics, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, ownerId, title, description, visibility, topics.join(','), now, now);
      this.#insertChapter(id, chapter, 0, now);
      this.#db.exec('commit');
    } catch (error) {
      this.#db.exec('rollback');
      throw error;
    }
    return id;
  }

  update(id: string, title: string, description: string, visibility: StudyVisibility, topics: readonly StudyTopic[]): void {
    this.#db
      .prepare('update studies set title = ?, description = ?, visibility = ?, topics = ?, updated_at = ? where id = ?')
      .run(title, description, visibility, topics.join(','), this.#now(), id);
  }

  setHidden(id: string, hidden: boolean): void {
    this.#db.prepare('update studies set hidden = ? where id = ?').run(hidden ? 1 : 0, id);
  }

  delete(id: string): void {
    this.#db.prepare('delete from studies where id = ?').run(id);
  }

  chapter(studyId: string, chapterId: string): StudyChapter | undefined {
    const row = this.#db
      .prepare('select id, name, fen, orientation, tree from study_chapters where study_id = ? and id = ?')
      .get(studyId, chapterId) as ChapterRow | undefined;
    return row && toChapter(row);
  }

  chapters(studyId: string): StudyChapter[] {
    const rows = this.#db
      .prepare('select id, name, fen, orientation, tree from study_chapters where study_id = ? order by position')
      .all(studyId) as unknown as ChapterRow[];
    return rows.map(toChapter);
  }

  addChapter(studyId: string, chapter: ChapterInput): StudyChapter {
    const now = this.#now();
    const { position } = this.#db
      .prepare('select coalesce(max(position), -1) + 1 as position from study_chapters where study_id = ?')
      .get(studyId) as { position: number };
    const id = this.#insertChapter(studyId, chapter, position, now);
    this.#touch(studyId, now);
    return { id, ...chapter };
  }

  updateChapter(studyId: string, chapterId: string, changes: { name: string; orientation: Color; root: StudyRoot }): void {
    const now = this.#now();
    this.#db
      .prepare('update study_chapters set name = ?, orientation = ?, tree = ?, updated_at = ? where study_id = ? and id = ?')
      .run(changes.name, changes.orientation, JSON.stringify(changes.root), now, studyId, chapterId);
    this.#touch(studyId, now);
  }

  deleteChapter(studyId: string, chapterId: string): void {
    this.#db.prepare('delete from study_chapters where study_id = ? and id = ?').run(studyId, chapterId);
    this.#touch(studyId, this.#now());
  }

  /** Puts a chapter at `index` among the study's chapters, shifting the others. */
  moveChapter(studyId: string, chapterId: string, index: number): void {
    const ids = (this.#db.prepare('select id from study_chapters where study_id = ? order by position').all(studyId) as Array<{ id: string }>).map(
      (row) => row.id,
    );
    const from = ids.indexOf(chapterId);
    if (from < 0) return;
    ids.splice(from, 1);
    ids.splice(Math.max(0, Math.min(ids.length, index)), 0, chapterId);
    const update = this.#db.prepare('update study_chapters set position = ? where id = ?');
    this.#db.exec('begin');
    ids.forEach((id, position) => update.run(position, id));
    this.#db.exec('commit');
    this.#touch(studyId, this.#now());
  }

  #insertChapter(studyId: string, chapter: ChapterInput, position: number, now: number): string {
    const id = randomId(8);
    this.#db
      .prepare(
        'insert into study_chapters (id, study_id, position, name, fen, orientation, tree, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(id, studyId, position, chapter.name, chapter.fen, chapter.orientation, JSON.stringify(chapter.root), now, now);
    return id;
  }

  #likes(userId: string, studyId: string): boolean {
    return this.#db.prepare('select 1 from study_likes where user_id = ? and study_id = ?').get(userId, studyId) !== undefined;
  }

  #touch(studyId: string, now: number): void {
    this.#db.prepare('update studies set updated_at = ? where id = ?').run(now, studyId);
  }
}
