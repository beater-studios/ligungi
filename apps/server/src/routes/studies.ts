import type { AppDeps } from '../app.ts';
import { isOrientation, STUDIES_MAX, STUDY_CHAPTER_NAME_MAX, STUDY_CHAPTERS_MAX, STUDY_QUERY_MAX, studyStart, studyText, type StudyList } from '@ligungi/protocol';
import { HttpError, sendJson, type Router } from '../http.ts';

/** Studies and their chapters. */
export const registerStudiesRoutes = (router: Router, deps: AppDeps): void => {
  const { chapterInput, checkedRoot, ownStudy, readableStudy, requireUser, studies, studyFields, studyLimiter } = deps;
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
      if (!studyLimiter.allow(userId)) throw new HttpError(429, 'tooManyAttempts');
      const body = (await ctx.body()) as Record<string, unknown>;
      const fields = studyFields(body, userId);
      const chapter = chapterInput(body.chapter);
      if (studies.count(userId) >= STUDIES_MAX) throw new HttpError(409, 'tooManyStudies');
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
      if (!chapter) throw new HttpError(404, 'chapterNotFound');
      sendJson(ctx.res, 200, chapter);
    })
    .add('POST', '/api/studies/:id/chapters', async (ctx) => {
      const study = ownStudy(ctx);
      const chapter = chapterInput(await ctx.body());
      if (study.chapters >= STUDY_CHAPTERS_MAX) throw new HttpError(409, 'tooManyChapters');
      sendJson(ctx.res, 200, studies.addChapter(study.id, chapter));
    })
    .add('POST', '/api/studies/:id/chapters/:chapter', async (ctx) => {
      const study = ownStudy(ctx);
      const current = studies.chapter(study.id, ctx.params.chapter!);
      if (!current) throw new HttpError(404, 'chapterNotFound');
      const { name, orientation, root } = (await ctx.body()) as Record<string, unknown>;
      const text = name === undefined ? current.name : studyText(name, STUDY_CHAPTER_NAME_MAX, true);
      const side = orientation === undefined ? current.orientation : orientation;
      if (text === null || !isOrientation(side)) throw new HttpError(400, 'invalidChapter');
      const tree = root === undefined ? current.root : checkedRoot(studyStart(current.fen)!, root);
      studies.updateChapter(study.id, current.id, { name: text, orientation: side, root: tree });
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('POST', '/api/studies/:id/chapters/:chapter/move', async (ctx) => {
      const study = ownStudy(ctx);
      if (!studies.chapter(study.id, ctx.params.chapter!)) throw new HttpError(404, 'chapterNotFound');
      const { index } = (await ctx.body()) as { index?: unknown };
      if (!Number.isInteger(index)) throw new HttpError(400, 'invalidChapter');
      studies.moveChapter(study.id, ctx.params.chapter!, index as number);
      sendJson(ctx.res, 200, studies.view(studies.get(study.id)!, study.ownerId));
    })
    .add('DELETE', '/api/studies/:id/chapters/:chapter', (ctx) => {
      const study = ownStudy(ctx);
      if (!studies.chapter(study.id, ctx.params.chapter!)) throw new HttpError(404, 'chapterNotFound');
      if (study.chapters <= 1) throw new HttpError(409, 'lastChapter');
      studies.deleteChapter(study.id, ctx.params.chapter!);
      sendJson(ctx.res, 200, studies.view(studies.get(study.id)!, study.ownerId));
    });
};
