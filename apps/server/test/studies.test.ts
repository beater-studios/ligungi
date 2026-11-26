import { MODES, applyMove, initialPosition, legalMoves, moveToString, parseMove, toFen } from '@ligungi/engine';
import {
  DAY_MS,
  STUDY_NODES_MAX,
  type ModLogEntry,
  type ReportView,
  type StudyChapter,
  type StudyLikes,
  type StudyList,
  type StudyNode,
  type StudyView,
} from '@ligungi/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import { Moderation, moderatorCommand } from '../src/moderation.ts';
import { Users } from '../src/users.ts';
import { Client, startServer, type TestServer } from './helpers.ts';

let server: TestServer | undefined;
let now = Date.now();
afterEach(async () => {
  await server?.close();
  server = undefined;
});

const start = async () => {
  now = Date.now();
  server = await startServer({ now: () => now });
};

const signup = async (name: string): Promise<Client> => {
  const c = new Client(server!.base);
  expect((await c.request('POST', '/api/signup', { username: name, password: 'segredo123' })).status).toBe(200);
  return c;
};

const introFen = toFen(initialPosition('intro'));
const chapter = (extra: object = {}) => ({ name: 'Abertura', fen: introFen, orientation: 'white', ...extra });
const node = (move: string, extra: Partial<StudyNode> = {}): StudyNode => ({ move, comment: '', shapes: [], children: [], ...extra });

const createStudy = async (c: Client, visibility = 'unlisted', title = 'Defesa do Marechal') => {
  const res = await c.request<StudyView>('POST', '/api/studies', { title, description: 'Como proteger', visibility, chapter: chapter() });
  expect(res.status).toBe(200);
  return res.data;
};

describe('studies', () => {
  it('creates a study, saves a chapter with variations, comments and drawings, and keeps it to its author', async () => {
    await start();
    const author = await signup('Kite');
    const other = await signup('Palm');
    const study = await createStudy(author);
    expect(study).toMatchObject({ title: 'Defesa do Marechal', visibility: 'unlisted', owner: { name: 'Kite' }, mine: true, hidden: false });
    expect(study.chapters).toHaveLength(1);
    const chapterId = study.chapters[0]!.id;

    const root = {
      comment: 'O plano das brancas',
      shapes: [{ kind: 'square', square: 40, color: 'green' }],
      children: [
        node('e3e4', { comment: 'O lance principal', shapes: [{ kind: 'arrow', from: 22, to: 31, color: 'red' }], children: [node('e7e6')] }),
        node('c3c4'),
      ],
    };
    const legal = await author.request('POST', `/api/studies/${study.id}/chapters/${chapterId}`, { root });
    expect(legal.status).toBe(200);
    const saved = (await other.request<StudyChapter>('GET', `/api/studies/${study.id}/chapters/${chapterId}`)).data;
    expect(saved.root).toEqual(root);
    expect((await other.request<StudyView>('GET', `/api/studies/${study.id}`)).data.mine).toBe(false);

    // Only the author writes, and only legal, well-formed trees.
    expect((await other.request('POST', `/api/studies/${study.id}/chapters/${chapterId}`, { root })).data).toMatchObject({ code: 'notStudyOwner' });
    expect((await new Client(server!.base).request('POST', `/api/studies/${study.id}`, { title: 'x', visibility: 'private' })).status).toBe(401);
    const illegal = { comment: '', shapes: [], children: [node('e3e9')] };
    expect((await author.request('POST', `/api/studies/${study.id}/chapters/${chapterId}`, { root: illegal })).data).toMatchObject({ code: 'invalidChapter' });
    const twice = { comment: '', shapes: [], children: [node('e3e4'), node('e3e4')] };
    expect((await author.request('POST', `/api/studies/${study.id}/chapters/${chapterId}`, { root: twice })).data).toMatchObject({ code: 'invalidChapter' });
  });

  it('starts chapters from the start of every mode, the draft modes included, and from a position in the middle of a draft', async () => {
    await start();
    const author = await signup('Kite');
    const study = await createStudy(author);
    for (const mode of MODES) {
      const res = await author.request<StudyChapter>('POST', `/api/studies/${study.id}/chapters`, chapter({ name: mode, fen: toFen(initialPosition(mode)) }));
      expect(res.status).toBe(200);
    }
    // A draft played a few placements in, with variations, and its position used as the start of another chapter.
    const draft = initialPosition('advanced');
    const [first, second] = legalMoves(draft).map(moveToString);
    const afterFirst = applyMove(draft, parseMove(first!)!);
    const reply = moveToString(legalMoves(afterFirst)[0]!);
    const root = { comment: '', shapes: [], children: [node(first!, { children: [node(reply)] }), node(second!)] };
    const advanced = (await author.request<StudyChapter>('POST', `/api/studies/${study.id}/chapters`, chapter({ fen: toFen(draft), root }))).data;
    expect(advanced.root).toEqual(root);
    expect((await author.request('POST', `/api/studies/${study.id}/chapters`, chapter({ fen: toFen(afterFirst) }))).status).toBe(200);
    // The editor's check still applies to the rest: two Marshals of one side are never a start.
    const twoMarshals = toFen(initialPosition('intro')).replace('3GML3', '3GMM3');
    expect((await author.request('POST', `/api/studies/${study.id}/chapters`, chapter({ fen: twoMarshals }))).data).toMatchObject({ code: 'invalidChapter' });
  });

  it('allows eight arrows and eight painted squares per move, checked by the server', async () => {
    await start();
    const author = await signup('Kite');
    const study = await createStudy(author);
    const path = `/api/studies/${study.id}/chapters/${study.chapters[0]!.id}`;
    const squares = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'square', square: i, color: 'blue' }));
    const arrows = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'arrow', from: i, to: i + 9, color: 'orange' }));
    const save = (shapes: object[]) => author.request('POST', path, { root: { comment: '', shapes, children: [] } });
    expect((await save([...squares(8), ...arrows(8)])).status).toBe(200);
    expect((await save(squares(9))).data).toMatchObject({ code: 'invalidChapter' });
    expect((await save(arrows(9))).data).toMatchObject({ code: 'invalidChapter' });
    expect((await save([{ kind: 'square', square: 3, color: 'pink' }])).data).toMatchObject({ code: 'invalidChapter' });
    expect((await save([{ kind: 'arrow', from: 3, to: 3, color: 'red' }])).data).toMatchObject({ code: 'invalidChapter' });
    expect((await save([{ kind: 'square', square: 81, color: 'red' }])).data).toMatchObject({ code: 'invalidChapter' });
    expect((await save([...squares(1), ...squares(1)])).data).toMatchObject({ code: 'invalidChapter' });
  });

  it('refuses a chapter with too many moves', async () => {
    await start();
    const author = await signup('Kite');
    const study = await createStudy(author);
    // Moving the same piece back and forth makes a long legal line.
    let line: StudyNode | null = null;
    const moves = ['e3e4', 'e7e6', 'e4e3', 'e6e7'];
    for (let i = STUDY_NODES_MAX; i >= 0; i--) line = node(moves[i % 4]!, { children: line ? [line] : [] });
    const res = await author.request('POST', `/api/studies/${study.id}/chapters/${study.chapters[0]!.id}`, { root: { comment: '', shapes: [], children: [line] } });
    expect(res.data).toMatchObject({ code: 'chapterTooLarge' });
  });

  it('adds, reorders and deletes chapters, but never the last one', async () => {
    await start();
    const author = await signup('Kite');
    const study = await createStudy(author);
    const added = (await author.request<StudyChapter>('POST', `/api/studies/${study.id}/chapters`, chapter({ name: 'Meio-jogo', orientation: 'black' }))).data;
    expect(added).toMatchObject({ name: 'Meio-jogo', orientation: 'black', root: { children: [] } });
    expect((await author.request('POST', `/api/studies/${study.id}/chapters`, chapter({ fen: 'nonsense' }))).data).toMatchObject({ code: 'invalidChapter' });
    const moved = (await author.request<StudyView>('POST', `/api/studies/${study.id}/chapters/${added.id}/move`, { index: 0 })).data;
    expect(moved.chapters.map((c) => c.name)).toEqual(['Meio-jogo', 'Abertura']);
    const left = (await author.request<StudyView>('DELETE', `/api/studies/${study.id}/chapters/${added.id}`)).data;
    expect(left.chapters.map((c) => c.name)).toEqual(['Abertura']);
    expect((await author.request('DELETE', `/api/studies/${study.id}/chapters/${left.chapters[0]!.id}`)).data).toMatchObject({ code: 'lastChapter' });
  });

  it('lists public studies to everyone, keeps private ones to the author and lets new accounts publish only after a week', async () => {
    await start();
    const author = await signup('Kite');
    expect((await author.request('POST', '/api/studies', { title: 'Cedo', visibility: 'public', chapter: chapter() })).data).toMatchObject({
      code: 'studyPublicTooSoon',
    });
    const hidden = await createStudy(author, 'private', 'Rascunho');
    const unlisted = await createStudy(author, 'unlisted', 'Pelo link');
    now += 7 * DAY_MS;
    const listed = await createStudy(author, 'public', 'Finais com o General');

    const anonymous = new Client(server!.base);
    const list = (await anonymous.request<StudyList>('GET', '/api/studies')).data;
    expect(list.studies.map((s) => s.title)).toEqual(['Finais com o General']);
    expect((await anonymous.request<StudyList>('GET', '/api/studies?q=GENERAL')).data.studies).toHaveLength(1);
    expect((await anonymous.request<StudyList>('GET', '/api/studies?q=torre')).data.studies).toHaveLength(0);
    expect((await anonymous.request('GET', `/api/studies/${unlisted.id}`)).status).toBe(200);
    expect((await anonymous.request('GET', `/api/studies/${hidden.id}`)).data).toMatchObject({ code: 'studyNotFound' });
    expect((await anonymous.request('GET', `/api/studies/${hidden.id}/chapters/${hidden.chapters[0]!.id}`)).status).toBe(404);
    expect((await anonymous.request('GET', '/api/studies?list=mine')).status).toBe(401);

    const mine = (await author.request<StudyList>('GET', '/api/studies?list=mine')).data.studies;
    expect(mine.map((s) => s.title)).toEqual(['Finais com o General', 'Pelo link', 'Rascunho']);
    expect((await author.request<StudyView>('POST', `/api/studies/${listed.id}`, { title: 'Finais', description: '', visibility: 'private' })).data.visibility).toBe(
      'private',
    );
    expect((await anonymous.request<StudyList>('GET', '/api/studies')).data.studies).toEqual([]);
  });

  it('takes reports about a study and lets moderators hide or delete it, with a log entry', async () => {
    await start();
    const author = await signup('Kite');
    const reader = await signup('Palm');
    const mod = await signup('Netero');
    moderatorCommand(new Moderation(server!.app.db, Date.now), new Users(server!.app.db, Date.now), ['moderator', 'add', 'Netero']);
    const study = await createStudy(author);

    expect((await author.request('POST', '/api/reports', { studyId: study.id, reason: 'content', details: '' })).data).toMatchObject({ code: 'cannotReportSelf' });
    expect((await reader.request('POST', '/api/reports', { studyId: 'missing1', reason: 'content', details: '' })).data).toMatchObject({ code: 'studyNotFound' });
    expect((await reader.request('POST', '/api/reports', { studyId: study.id, reason: 'content', details: 'Desenho ofensivo' })).status).toBe(200);
    // A report about the study does not block a report about its author, and the other way round.
    expect((await reader.request('POST', '/api/reports', { username: 'Kite', reason: 'behavior', details: '' })).status).toBe(200);
    expect((await reader.request('POST', '/api/reports', { studyId: study.id, reason: 'content', details: '' })).data).toMatchObject({ code: 'alreadyReported' });
    // A report on a chapter keeps the chapter and the move; a chapter of another study, or a made-up path, is dropped.
    const chapterId = study.chapters[0]!.id;
    expect((await reader.request('POST', '/api/reports', { studyId: study.id, chapterId, chapterPath: '0.1', reason: 'content', details: '' })).status).toBe(200);
    expect((await reader.request('POST', '/api/reports', { studyId: study.id, chapterId, chapterPath: '0.1', reason: 'content', details: '' })).data).toMatchObject({
      code: 'alreadyReported',
    });
    const other = await signup('Gon');
    const otherStudy = await createStudy(author);
    expect((await other.request('POST', '/api/reports', { studyId: otherStudy.id, chapterId, chapterPath: 'x;drop', reason: 'content', details: '' })).status).toBe(200);
    const reports = (await mod.request<ReportView[]>('GET', '/api/mod/reports')).data;
    expect(reports.map((report) => [report.target.name, report.studyId, report.chapterId, report.chapterPath, report.reason])).toEqual([
      ['Kite', study.id, null, null, 'content'],
      ['Kite', null, null, null, 'behavior'],
      ['Kite', study.id, chapterId, '0.1', 'content'],
      ['Kite', otherStudy.id, null, null, 'content'],
    ]);

    expect((await reader.request('POST', `/api/mod/studies/${study.id}/hide`, { reason: 'x' })).status).toBe(403);
    expect((await mod.request('POST', `/api/mod/studies/${study.id}/hide`, { reason: 'Desenho ofensivo' })).status).toBe(200);
    expect((await reader.request('GET', `/api/studies/${study.id}`)).status).toBe(404);
    expect((await author.request<StudyView>('GET', `/api/studies/${study.id}`)).data.hidden).toBe(true);
    expect((await mod.request('GET', `/api/studies/${study.id}`)).status).toBe(200);
    expect((await mod.request('POST', `/api/mod/studies/${study.id}/hide`, { hidden: false, reason: 'Revisado' })).status).toBe(200);
    expect((await reader.request('GET', `/api/studies/${study.id}`)).status).toBe(200);

    // A private study stays with its author, even for the moderators.
    const own = await createStudy(author, 'private', 'Rascunho');
    expect((await mod.request('GET', `/api/studies/${own.id}`)).status).toBe(404);

    // Clearing a chapter's drawings keeps its moves and comments, tells the author and is logged.
    const drawn = `/api/studies/${study.id}/chapters/${chapterId}`;
    const shaped = { comment: 'Veja', shapes: [{ kind: 'square', square: 40, color: 'red' }], children: [node('e3e4', { shapes: [{ kind: 'arrow', from: 22, to: 31, color: 'red' }] })] };
    expect((await author.request('POST', drawn, { root: shaped })).status).toBe(200);
    expect((await reader.request('POST', `${drawn.replace('/api/studies', '/api/mod/studies')}/clear-drawings`, { reason: 'x' })).status).toBe(403);
    expect((await mod.request('POST', `/api/mod/studies/${study.id}/chapters/nothere1/clear-drawings`, { reason: 'x' })).status).toBe(404);
    expect((await mod.request('POST', `/api/mod/studies/${study.id}/chapters/${chapterId}/clear-drawings`, { reason: '' })).data).toMatchObject({ code: 'reasonRequired' });
    expect((await mod.request('POST', `/api/mod/studies/${study.id}/chapters/${chapterId}/clear-drawings`, { reason: 'Desenho obsceno' })).status).toBe(200);
    const cleared = (await reader.request<StudyChapter>('GET', drawn)).data.root;
    expect(cleared).toMatchObject({ comment: 'Veja', shapes: [], children: [{ move: 'e3e4', shapes: [] }] });
    expect(server!.app.db.prepare("select subject from notices where kind = 'studyDrawingsCleared'").all()).toEqual([{ subject: study.title }]);

    expect((await mod.request('POST', `/api/mod/studies/${study.id}/delete`, { reason: 'Reincidente' })).status).toBe(200);
    expect((await author.request('GET', `/api/studies/${study.id}`)).status).toBe(404);
    const log = (await mod.request<ModLogEntry[]>('GET', '/api/mod/log')).data;
    expect(log.slice(0, 4).map((entry) => [entry.action, entry.target])).toEqual([
      ['deleteStudy', 'Kite'],
      ['clearDrawings', 'Kite'],
      ['unhideStudy', 'Kite'],
      ['hideStudy', 'Kite'],
    ]);
  });

  it('exports the studies with the account data and deletes them with the account', async () => {
    await start();
    const author = await signup('Kite');
    const study = await createStudy(author);
    const exported = (await author.request<{ studies: Array<{ id: string; chapters: StudyChapter[] }> }>('GET', '/api/account/export')).data.studies;
    expect(exported.map((s) => [s.id, s.chapters.length])).toEqual([[study.id, 1]]);
    expect((await author.request('POST', '/api/account/delete', { password: 'segredo123' })).status).toBe(200);
    const left = server!.app.db.prepare('select (select count(*) from studies) as studies, (select count(*) from study_chapters) as chapters').get();
    expect(left).toEqual({ studies: 0, chapters: 0 });
  });
});

describe('study likes', () => {
  const like = (c: Client, id: string) => c.request<StudyLikes>('POST', `/api/studies/${id}/like`);
  const unlike = (c: Client, id: string) => c.request<StudyLikes>('DELETE', `/api/studies/${id}/like`);

  it('counts one like per player, takes it back, and asks for an account', async () => {
    await start();
    now -= 8 * DAY_MS;
    const author = await signup('Kite');
    const palm = await signup('Palm');
    now += 8 * DAY_MS;
    const study = await createStudy(author, 'public');
    expect(study).toMatchObject({ likes: 0, liked: false });

    expect((await like(palm, study.id)).data).toEqual({ likes: 1, liked: true });
    expect((await like(palm, study.id)).data).toEqual({ likes: 1, liked: true });
    expect((await like(author, study.id)).data).toEqual({ likes: 2, liked: true });
    expect((await palm.request<StudyView>('GET', `/api/studies/${study.id}`)).data).toMatchObject({ likes: 2, liked: true });
    expect((await unlike(palm, study.id)).data).toEqual({ likes: 1, liked: false });
    expect((await palm.request<StudyView>('GET', `/api/studies/${study.id}`)).data).toMatchObject({ likes: 1, liked: false });

    const anonymous = new Client(server!.base);
    expect((await anonymous.request<StudyView>('GET', `/api/studies/${study.id}`)).data).toMatchObject({ likes: 1, liked: false });
    expect((await like(anonymous, study.id)).status).toBe(401);
    expect((await anonymous.request('GET', '/api/studies?list=liked')).status).toBe(401);
  });

  it('lists the most liked first and keeps each player a list of the studies they like', async () => {
    await start();
    now -= 8 * DAY_MS;
    const author = await signup('Kite');
    const fans = [await signup('Palm'), await signup('Ikalgo'), await signup('Meleoron')];
    now += 8 * DAY_MS;
    const quiet = await createStudy(author, 'public', 'Pouco visto');
    const loved = await createStudy(author, 'public', 'Muito curtido');
    const liked = await createStudy(author, 'public', 'Curtido');
    now += 1000;
    const latest = await createStudy(author, 'public', 'Mais novo');
    for (const fan of fans) await like(fan, loved.id);
    await like(fans[0]!, liked.id);

    const titles = async (query: string, c: Client = author) => (await c.request<StudyList>('GET', `/api/studies${query}`)).data.studies.map((s) => s.title);
    expect(await titles('')).toEqual(['Mais novo', 'Curtido', 'Muito curtido', 'Pouco visto']);
    expect(await titles('?sort=liked')).toEqual(['Muito curtido', 'Curtido', 'Mais novo', 'Pouco visto']);
    expect(await titles('?sort=nonsense')).toEqual(await titles(''));
    expect((await author.request<StudyList>('GET', '/api/studies?sort=liked')).data.studies[0]).toMatchObject({ title: 'Muito curtido', likes: 3 });

    expect(await titles('?list=liked', fans[0])).toEqual(['Curtido', 'Muito curtido']);
    expect(await titles('?list=liked&q=muito', fans[0])).toEqual(['Muito curtido']);
    expect(await titles('?list=liked', fans[1])).toEqual(['Muito curtido']);
    expect(quiet.likes + latest.likes).toBe(0);
  });

  it('cannot like a study the player may not open, and leaves hidden ones out of the lists', async () => {
    await start();
    now -= 8 * DAY_MS;
    const author = await signup('Kite');
    const palm = await signup('Palm');
    now += 8 * DAY_MS;
    const draft = await createStudy(author, 'private', 'Rascunho');
    expect((await like(palm, draft.id)).data).toMatchObject({ code: 'studyNotFound' });
    const unlisted = await createStudy(author, 'unlisted', 'Pelo link');
    expect((await like(palm, unlisted.id)).data).toEqual({ likes: 1, liked: true });

    const study = await createStudy(author, 'public', 'Polêmico');
    await like(palm, study.id);
    server!.app.db.prepare('update studies set hidden = 1 where id = ?').run(study.id);
    expect((await palm.request<StudyList>('GET', '/api/studies?sort=liked')).data.studies).toEqual([]);
    expect((await palm.request<StudyList>('GET', '/api/studies?list=liked')).data.studies.map((s) => s.title)).toEqual(['Pelo link']);
    expect((await like(palm, study.id)).data).toMatchObject({ code: 'studyNotFound' });
  });

  it('exports the likes with the account and forgets them with the account or the study', async () => {
    await start();
    now -= 8 * DAY_MS;
    const author = await signup('Kite');
    const palm = await signup('Palm');
    const knuckle = await signup('Knuckle');
    now += 8 * DAY_MS;
    const study = await createStudy(author, 'public');
    const other = await createStudy(author, 'public', 'Outro');
    await like(palm, study.id);
    await like(knuckle, study.id);
    await like(knuckle, other.id);

    const data = (await palm.request<{ likedStudies: Array<{ study: string; likedAt: string }> }>('GET', '/api/account/export')).data;
    expect(data.likedStudies).toEqual([{ study: study.id, likedAt: new Date(now).toISOString() }]);

    expect((await palm.request('POST', '/api/account/delete', { password: 'segredo123' })).status).toBe(200);
    expect((await author.request<StudyView>('GET', `/api/studies/${study.id}`)).data.likes).toBe(1);
    expect((await author.request('DELETE', `/api/studies/${other.id}`)).status).toBe(200);
    const left = server!.app.db.prepare('select count(*) as n from study_likes where study_id = ?').get(other.id) as { n: number };
    expect(left.n).toBe(0);
  });
});
