import type { AppDeps } from '../app.ts';
import { isOrientation, STUDIES_MAX, STUDY_CHAPTER_NAME_MAX, STUDY_CHAPTERS_MAX, STUDY_QUERY_MAX, studyStart, studyText, DAY_MS, STUDY_DESCRIPTION_MAX, STUDY_PUBLIC_MIN_DAYS, STUDY_TITLE_MAX, emptyRoot, isStudyVisibility, parseStudyRoot, type StudyList, type StudyRoot } from '@ligungi/protocol';
import { HttpError, sendJson, type Router, type Context } from '../http.ts';
import { requireUser } from './guards.ts';
import type { ChapterInput, StudyRecord } from '../studies.ts';

const checkedRoot = (start: Parameters<typeof parseStudyRoot>[0], value: unknown): StudyRoot => {
  const root = value === undefined ? emptyRoot() : parseStudyRoot(start, value);
  if (root === 'tooLarge') throw new HttpError('chapterTooLarge');
  if (!root) throw new HttpError('invalidChapter');
  return root;
};

const chapterInput = (value: unknown): ChapterInput => {
  if (typeof value !== 'object' || value === null) throw new HttpError('invalidChapter');
  const { name, fen, orientation, root } = value as Record<string, unknown>;
  const text = studyText(name, STUDY_CHAPTER_NAME_MAX, true);
  const start = studyStart(fen);
  if (text === null || !start || !isOrientation(orientation)) throw new HttpError('invalidChapter');
  return { name: text, fen: fen as string, orientation, root: checkedRoot(start, root) };
};

/** Studies and their chapters. */
export const registerStudiesRoutes = (router: Router, deps: AppDeps): void => {
  const { config, moderation, studies, studyLimiter, users } = deps;

  /** A study the viewer may open; one they may not is reported as missing, so its existence does not leak. */
  const readableStudy = (ctx: Context): StudyRecord => {
    const study = studies.get(ctx.params.id!);
    if (!study || !studies.canRead(study, ctx.session.userId, moderation.isModerator(ctx.session.userId))) throw new HttpError('studyNotFound');
    return study;
  };

  /** A study the signed-in user wrote and is about to change. */
  const ownStudy = (ctx: Context): StudyRecord => {
    const userId = requireUser(ctx);
    if (!studyLimiter.allow(userId)) throw new HttpError('tooManyAttempts');
    const study = readableStudy(ctx);
    if (study.ownerId !== userId) throw new HttpError('notStudyOwner');
    return study;
  };

  /** Title, description and visibility of a study; new accounts may not make one public yet. */
  const studyFields = (body: Record<string, unknown>, userId: string) => {
    const title = studyText(body.title, STUDY_TITLE_MAX, true);
    const description = studyText(body.description ?? '', STUDY_DESCRIPTION_MAX, false);
    const { visibility } = body;
    if (title === null || description === null || !isStudyVisibility(visibility)) throw new HttpError('invalidStudy');
    const user = users.findById(userId);
    if (visibility === 'public' && (!user || config.now() - user.createdAt < STUDY_PUBLIC_MIN_DAYS * DAY_MS)) {
      throw new HttpError('studyPublicTooSoon');
    }
    return { title, description, visibility };
  };

  router
    .add('GET', '/api/studies', (ctx) => {
      const params = ctx.url.searchParams;
      const query = (params.get('q') ?? '').trim().slice(0, STUDY_QUERY_MAX);
      if (params.get('list') === 'mine') {
        const list: StudyList = { studies: studies.byOwner(requireUser(ctx), query), more: false };
        sendJson(ctx.res, 200, list);
        return;
      }
      const page = Math.min(1000, Math.max(1, Math.trunc(Number(params.get('page'))) || 1));
      const list: StudyList = studies.listed(query, page);
      sendJson(ctx.res, 200, list);
    })
    .add('POST', '/api/studies', async (ctx) => {
      const userId = requireUser(ctx);
      if (!studyLimiter.allow(userId)) throw new HttpError('tooManyAttempts');
      const body = (await ctx.body()) as Record<string, unknown>;
      const fields = studyFields(body, userId);
      const chapter = chapterInput(body.chapter);
      if (studies.count(userId) >= STUDIES_MAX) throw new HttpError('tooManyStudies');
      const id = studies.create(userId, fields.title, fields.description, fields.visibility, chapter);
      sendJson(ctx.res, 200, studies.view(studies.get(id)!, userId));
    })
    .add('GET', '/api/studies/:id', (ctx) => {
      sendJson(ctx.res, 200, studies.view(readableStudy(ctx), ctx.session.userId));
    })
    .add('POST', '/api/studies/:id', async (ctx) => {
      const study = ownStudy(ctx);
      const fields = studyFields((await ctx.body()) as Record<string, unknown>, study.ownerId);
      studies.update(study.id, fields.title, fields.description, fields.visibility);
      sendJson(ctx.res, 200, studies.view(studies.get(study.id)!, study.ownerId));
    })
    .add('DELETE', '/api/studies/:id', (ctx) => {
      studies.delete(ownStudy(ctx).id);
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('GET', '/api/studies/:id/chapters/:chapter', (ctx) => {
      const chapter = studies.chapter(readableStudy(ctx).id, ctx.params.chapter!);
      if (!chapter) throw new HttpError('chapterNotFound');
      sendJson(ctx.res, 200, chapter);
    })
    .add('POST', '/api/studies/:id/chapters', async (ctx) => {
      const study = ownStudy(ctx);
      const chapter = chapterInput(await ctx.body());
      if (study.chapters >= STUDY_CHAPTERS_MAX) throw new HttpError('tooManyChapters');
      sendJson(ctx.res, 200, studies.addChapter(study.id, chapter));
    })
    .add('POST', '/api/studies/:id/chapters/:chapter', async (ctx) => {
      const study = ownStudy(ctx);
      const current = studies.chapter(study.id, ctx.params.chapter!);
      if (!current) throw new HttpError('chapterNotFound');
      const { name, orientation, root } = (await ctx.body()) as Record<string, unknown>;
      const text = name === undefined ? current.name : studyText(name, STUDY_CHAPTER_NAME_MAX, true);
      const side = orientation === undefined ? current.orientation : orientation;
      if (text === null || !isOrientation(side)) throw new HttpError('invalidChapter');
      const tree = root === undefined ? current.root : checkedRoot(studyStart(current.fen)!, root);
      studies.updateChapter(study.id, current.id, { name: text, orientation: side, root: tree });
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('POST', '/api/studies/:id/chapters/:chapter/move', async (ctx) => {
      const study = ownStudy(ctx);
      if (!studies.chapter(study.id, ctx.params.chapter!)) throw new HttpError('chapterNotFound');
      const { index } = (await ctx.body()) as { index?: unknown };
      if (!Number.isInteger(index)) throw new HttpError('invalidChapter');
      studies.moveChapter(study.id, ctx.params.chapter!, index as number);
      sendJson(ctx.res, 200, studies.view(studies.get(study.id)!, study.ownerId));
    })
    .add('DELETE', '/api/studies/:id/chapters/:chapter', (ctx) => {
      const study = ownStudy(ctx);
      if (!studies.chapter(study.id, ctx.params.chapter!)) throw new HttpError('chapterNotFound');
      if (study.chapters <= 1) throw new HttpError('lastChapter');
      studies.deleteChapter(study.id, ctx.params.chapter!);
      sendJson(ctx.res, 200, studies.view(studies.get(study.id)!, study.ownerId));
    });
};
