import { MODES, moveToString, parseGameRecord, type Mode, type RecordError } from '@ligungi/engine';
import { useState } from 'preact/hooks';
import { useT, type Messages } from '../i18n/index.ts';
import { navigate } from '../router.ts';
import { Modal } from './Modal.tsx';
import { Field, Select, SubmitButton } from './ui.tsx';

/** Larger files are not games: the longest games take a few kilobytes. */
const MAX_FILE_BYTES = 200_000;

const errorText = (t: Messages, error: RecordError): string => {
  const e = t.analysis.importErrors;
  switch (error.kind) {
    case 'empty':
      return e.empty;
    case 'badMode':
      return e.badMode(error.line, error.text);
    case 'unreadable':
      return e.unreadable(error.line, error.text);
    case 'illegal':
      return e.illegal(error.line, error.text);
    case 'ambiguous':
      return e.ambiguous(error.line, error.text);
    case 'afterEnd':
      return e.afterEnd(error.line, error.text);
  }
};

/**
 * Imports a game in the export format (or typed by hand, in rulebook or machine notation) into the analysis. Every move
 * is checked by the rules before anything opens; an imported game is never a played game, so it touches no rating.
 */
export const ImportGame = ({ onClose }: { onClose: () => void }) => {
  const t = useT();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<Mode>('advanced');
  const [error, setError] = useState<string | null>(null);

  const readFile = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setError(t.analysis.importErrors.tooBig);
    setText(await file.text());
    setError(null);
  };

  const submit = (event: Event) => {
    event.preventDefault();
    const record = parseGameRecord(text, mode);
    if ('kind' in record) return setError(errorText(t, record));
    const params = new URLSearchParams({ mode: record.mode, first: record.firstPlayer, moves: record.moves.map(moveToString).join(',') });
    if (record.freeDraft) params.set('free', '1');
    onClose();
    navigate(`/analysis?${params.toString()}`);
  };

  return (
    <Modal title={t.analysis.importTitle} onClose={onClose}>
      <form class="form3 ligungi-import" onSubmit={submit}>
        <p class="ligungi-notice">{t.analysis.importHelp}</p>
        <Field label={t.analysis.importText} htmlFor="import-text">
          <textarea
            id="import-text"
            class="form-control"
            rows={10}
            spellcheck={false}
            value={text}
            onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          />
        </Field>
        <Field label={t.analysis.importFile} htmlFor="import-file">
          <input id="import-file" type="file" accept=".txt,text/plain" onChange={(event) => void readFile(event)} />
        </Field>
        <Field label={t.common.mode} htmlFor="import-mode" help={t.analysis.importModeHelp}>
          <Select id="import-mode" value={mode} options={MODES.map((m) => ({ value: m, label: t.modes[m] }))} onChange={setMode} />
        </Field>
        {error && <p class="error">{error}</p>}
        <SubmitButton disabled={!text.trim()}>{t.analysis.importButton}</SubmitButton>
      </form>
    </Modal>
  );
};
