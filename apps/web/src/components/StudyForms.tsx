import { MODES, initialPosition, moveToString, parseGameRecord, toFen, type Color, type Mode } from '@ligungi/engine';
import {
  STUDY_CHAPTER_NAME_MAX,
  STUDY_DESCRIPTION_MAX,
  STUDY_TITLE_MAX,
  STUDY_VISIBILITIES,
  chapterFits,
  emptyRoot,
  studyStart,
  type GameView,
  type StudyChapter,
  type StudyRoot,
  type StudyView,
  type StudyVisibility,
} from '@ligungi/protocol';
import { useState } from 'preact/hooks';
import { api } from '../api.ts';
import { errorText, useT, type Messages } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { navigate } from '../router.ts';
import { lineRoot } from '../studyTree.ts';
import { recordErrorText } from './ImportGame.tsx';
import { Modal } from './Modal.tsx';
import { Field, FieldRow, OptionCards, Select, SubmitButton } from './ui.tsx';

export interface StudyFieldsValue {
  readonly title: string;
  readonly description: string;
  readonly visibility: StudyVisibility;
}

const StudyFields = ({ value, onChange }: { value: StudyFieldsValue; onChange: (value: StudyFieldsValue) => void }) => {
  const t = useT();
  return (
    <>
      <Field label={t.study.studyTitle} htmlFor="study-title">
        <input
          id="study-title"
          class="form-control"
          required
          maxLength={STUDY_TITLE_MAX}
          value={value.title}
          onInput={(e) => onChange({ ...value, title: (e.target as HTMLInputElement).value })}
        />
      </Field>
      <Field label={t.study.description} htmlFor="study-description">
        <textarea
          id="study-description"
          class="form-control"
          rows={2}
          maxLength={STUDY_DESCRIPTION_MAX}
          value={value.description}
          onInput={(e) => onChange({ ...value, description: (e.target as HTMLTextAreaElement).value })}
        />
      </Field>
      <OptionCards
        name="study-visibility"
        legend={t.study.visibility}
        layout="segmented"
        value={value.visibility}
        options={STUDY_VISIBILITIES.map((v) => ({ value: v, label: t.study.visibilities[v] }))}
        onChange={(visibility) => onChange({ ...value, visibility })}
        help={`${t.study.visibilityHints[value.visibility]} ${t.study.publicHelp}`}
      />
    </>
  );
};

type ChapterSource = 'mode' | 'fen' | 'game' | 'import';

interface ChapterState {
  readonly name: string;
  readonly source: ChapterSource;
  readonly mode: Mode;
  readonly fen: string;
  readonly game: string;
  readonly text: string;
  readonly orientation: Color;
}

export interface ChapterInput {
  readonly name: string;
  readonly fen: string;
  readonly orientation: Color;
  readonly root: StudyRoot;
}

const newChapter = (name: string): ChapterState => ({ name, source: 'mode', mode: 'advanced', fen: '', game: '', text: '', orientation: 'white' });

/** A game's id, alone or at the end of its link. */
const GAME_ID = /(?:^|\/)([A-Za-z0-9]{8})\/?$/;

/** What the chapter form describes, ready to send: the start position and, from a game, its moves as the main line. */
const buildChapter = async (t: Messages, state: ChapterState): Promise<ChapterInput | string> => {
  const name = state.name.trim();
  if (!name) return t.study.nameRequired;
  const chapter = (fen: string, root: StudyRoot): ChapterInput | string =>
    chapterFits(root) ? { name, fen, orientation: state.orientation, root } : errorText(t, 'chapterTooLarge');
  switch (state.source) {
    case 'mode':
      return chapter(toFen(initialPosition(state.mode)), emptyRoot());
    case 'fen': {
      const position = studyStart(state.fen.trim());
      return position ? chapter(toFen(position), emptyRoot()) : t.analysis.invalidFen;
    }
    case 'game': {
      const id = GAME_ID.exec(state.game.trim())?.[1];
      if (!id) return errorText(t, 'gameNotFound');
      try {
        const game = await api.get<GameView>(`/api/games/${id}`);
        return chapter(toFen(initialPosition(game.mode, game.firstPlayer, { freeDraft: game.freeDraft })), lineRoot(game.moves));
      } catch (err) {
        return (err as Error).message;
      }
    }
    case 'import': {
      const record = parseGameRecord(state.text, state.mode);
      if ('kind' in record) return recordErrorText(t, record);
      const start = initialPosition(record.mode, record.firstPlayer, { freeDraft: record.freeDraft });
      return chapter(toFen(start), lineRoot(record.moves.map(moveToString)));
    }
  }
};

const ChapterFields = ({ value, onChange }: { value: ChapterState; onChange: (value: ChapterState) => void }) => {
  const t = useT();
  const set = (changes: Partial<ChapterState>) => onChange({ ...value, ...changes });
  const sources: readonly ChapterSource[] = ['mode', 'fen', 'game', 'import'];
  return (
    <>
      <FieldRow>
        <Field label={t.study.chapterName} htmlFor="chapter-name">
          <input
            id="chapter-name"
            class="form-control"
            required
            maxLength={STUDY_CHAPTER_NAME_MAX}
            value={value.name}
            onInput={(e) => set({ name: (e.target as HTMLInputElement).value })}
          />
        </Field>
        <OptionCards
          name="chapter-orientation"
          legend={t.study.orientation}
          layout="segmented"
          value={value.orientation}
          options={(['white', 'black'] as const).map((color) => ({ value: color, label: t.colors[color] }))}
          onChange={(orientation) => set({ orientation })}
        />
      </FieldRow>
      <OptionCards
        name="chapter-source"
        legend={t.study.startFrom}
        layout="segmented"
        value={value.source}
        options={sources.map((source) => ({ value: source, label: t.study.sources[source] }))}
        onChange={(source) => set({ source })}
      />
      <div class="ligungi-study-form__box">
        {(value.source === 'mode' || value.source === 'import') && (
          <Field label={t.common.mode} htmlFor="chapter-mode" {...(value.source === 'import' ? { help: t.analysis.importModeHelp } : {})}>
            <Select id="chapter-mode" value={value.mode} options={MODES.map((m) => ({ value: m, label: t.modes[m] }))} onChange={(mode) => set({ mode })} />
          </Field>
        )}
        {value.source === 'fen' && (
          <Field label="FEN" htmlFor="chapter-fen" help={t.study.fenHelp}>
            <input id="chapter-fen" class="form-control" spellcheck={false} value={value.fen} onInput={(e) => set({ fen: (e.target as HTMLInputElement).value })} />
          </Field>
        )}
        {value.source === 'game' && (
          <Field label={t.study.gameLink} htmlFor="chapter-game" help={t.study.gameHelp}>
            <input id="chapter-game" class="form-control" spellcheck={false} value={value.game} onInput={(e) => set({ game: (e.target as HTMLInputElement).value })} />
          </Field>
        )}
        {value.source === 'import' && (
          <Field label={t.analysis.importText} htmlFor="chapter-import" help={t.study.importHelp}>
            <textarea
              id="chapter-import"
              class="form-control"
              rows={4}
              spellcheck={false}
              value={value.text}
              onInput={(e) => set({ text: (e.target as HTMLTextAreaElement).value })}
            />
          </Field>
        )}
      </div>
    </>
  );
};

/** Creates a study with its first chapter, then opens it. */
export const NewStudyModal = ({ onClose }: { onClose: () => void }) => {
  const t = useT();
  const [fields, setFields] = useState<StudyFieldsValue>({ title: '', description: '', visibility: 'unlisted' });
  const [chapter, setChapter] = useState<ChapterState>(newChapter(t.study.firstChapter));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const built = await buildChapter(t, chapter);
    if (typeof built === 'string') {
      setBusy(false);
      return setError(built);
    }
    try {
      const study = await api.post<StudyView>('/api/studies', { ...fields, chapter: built });
      onClose();
      navigate(`/study/${study.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title={t.study.newStudy} onClose={onClose}>
      <form class="form3 ligungi-study-form" onSubmit={(e) => void submit(e)}>
        <StudyFields value={fields} onChange={setFields} />
        <h3 class="ligungi-study-form__part">{t.study.firstChapterTitle}</h3>
        <ChapterFields value={chapter} onChange={setChapter} />
        {error && <p class="error">{error}</p>}
        <SubmitButton disabled={busy || !fields.title.trim()}>{t.study.create}</SubmitButton>
      </form>
    </Modal>
  );
};

/** Adds a chapter at the end of a study. */
export const NewChapterModal = ({ study, onClose, onCreated }: { study: StudyView; onClose: () => void; onCreated: (chapter: StudyChapter) => void }) => {
  const t = useT();
  const [chapter, setChapter] = useState<ChapterState>(newChapter(t.study.chapterNumber(study.chapters.length + 1)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const built = await buildChapter(t, chapter);
    if (typeof built === 'string') {
      setBusy(false);
      return setError(built);
    }
    try {
      onCreated(await api.post<StudyChapter>(`/api/studies/${study.id}/chapters`, built));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title={t.study.newChapter} onClose={onClose}>
      <form class="form3 ligungi-study-form" onSubmit={(e) => void submit(e)}>
        <ChapterFields value={chapter} onChange={setChapter} />
        {error && <p class="error">{error}</p>}
        <SubmitButton disabled={busy}>{t.study.addChapter}</SubmitButton>
      </form>
    </Modal>
  );
};

/** A delete button that asks once more before acting. */
const DeleteButton = ({ label, confirm, onDelete }: { label: string; confirm: string; onDelete: () => void }) => {
  const [asking, setAsking] = useState(false);
  return (
    <button type="button" class={`button button-empty ${asking ? 'button-red' : ''} text`} data-icon={icons.Trash} onClick={() => (asking ? onDelete() : setAsking(true))}>
      {asking ? confirm : label}
    </button>
  );
};

/** The author changes the study's title, description and visibility, or deletes it. */
export const StudySettingsModal = ({ study, onClose, onSaved }: { study: StudyView; onClose: () => void; onSaved: (study: StudyView) => void }) => {
  const t = useT();
  const [fields, setFields] = useState<StudyFieldsValue>({ title: study.title, description: study.description, visibility: study.visibility });
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: Event) => {
    event.preventDefault();
    setError(null);
    try {
      onSaved(await api.post<StudyView>(`/api/studies/${study.id}`, fields));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/api/studies/${study.id}`);
      onClose();
      navigate('/study?list=mine');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal title={t.study.settings} onClose={onClose}>
      <form class="form3 ligungi-study-form" onSubmit={(e) => void submit(e)}>
        <StudyFields value={fields} onChange={setFields} />
        {error && <p class="error">{error}</p>}
        <SubmitButton disabled={!fields.title.trim()}>{t.study.save}</SubmitButton>
        <div class="ligungi-study-form__danger">
          <DeleteButton label={t.study.deleteStudy} confirm={t.study.confirmDeleteStudy} onDelete={() => void remove()} />
        </div>
      </form>
    </Modal>
  );
};

/** The author renames a chapter, turns its board, or deletes it. */
export const ChapterSettingsModal = ({
  study,
  chapter,
  onClose,
  onMoved,
  onSaved,
  onDeleted,
}: {
  study: StudyView;
  chapter: StudyChapter;
  onClose: () => void;
  onMoved: (study: StudyView) => void;
  onSaved: (name: string, orientation: Color) => void;
  onDeleted: (study: StudyView) => void;
}) => {
  const t = useT();
  const [name, setName] = useState(chapter.name);
  const [orientation, setOrientation] = useState<Color>(chapter.orientation);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: Event) => {
    event.preventDefault();
    setError(null);
    try {
      await api.post(`/api/studies/${study.id}/chapters/${chapter.id}`, { name, orientation });
      onSaved(name.trim(), orientation);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const index = study.chapters.findIndex((c) => c.id === chapter.id);
  const move = async (to: number) => {
    setError(null);
    try {
      onMoved(await api.post<StudyView>(`/api/studies/${study.id}/chapters/${chapter.id}/move`, { index: to }));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async () => {
    try {
      onDeleted(await api.delete<StudyView>(`/api/studies/${study.id}/chapters/${chapter.id}`));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal title={t.study.chapterSettings} onClose={onClose}>
      <form class="form3 ligungi-study-form" onSubmit={(e) => void submit(e)}>
        <Field label={t.study.chapterName} htmlFor="chapter-rename">
          <input
            id="chapter-rename"
            class="form-control"
            required
            maxLength={STUDY_CHAPTER_NAME_MAX}
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
          />
        </Field>
        <OptionCards
          name="chapter-turn"
          legend={t.study.orientation}
          layout="segmented"
          value={orientation}
          options={(['white', 'black'] as const).map((color) => ({ value: color, label: t.colors[color] }))}
          onChange={setOrientation}
        />
        {study.chapters.length > 1 && (
          <Field label={t.study.chapterOrder}>
            <div class="ligungi-study__actions">
              <button type="button" class="button button-empty text" data-icon={icons.UpTriangle} disabled={index <= 0} onClick={() => void move(index - 1)}>
                {t.study.moveUp}
              </button>
              <button
                type="button"
                class="button button-empty text"
                data-icon={icons.DownTriangle}
                disabled={index < 0 || index >= study.chapters.length - 1}
                onClick={() => void move(index + 1)}
              >
                {t.study.moveDown}
              </button>
            </div>
          </Field>
        )}
        {error && <p class="error">{error}</p>}
        <SubmitButton disabled={!name.trim()}>{t.study.save}</SubmitButton>
        {study.chapters.length > 1 && (
          <div class="ligungi-study-form__danger">
            <DeleteButton label={t.study.deleteChapter} confirm={t.study.confirmDeleteChapter} onDelete={() => void remove()} />
          </div>
        )}
      </form>
    </Modal>
  );
};
