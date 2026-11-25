import { useEffect, useState } from 'preact/hooks';
import { inActivity, openExternal } from '../discordActivity.ts';
import { useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { SITE_URL } from '../source.ts';
import { Modal } from './Modal.tsx';

/** The game record in a dialog, to copy or save as a file, instead of a raw text page in a new tab. */
export const ExportGame = ({ gameId }: { gameId: string }) => {
  const t = useT();
  const g = t.game;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const path = `/api/games/${gameId}/export`;

  useEffect(() => {
    if (!open) return;
    let live = true;
    setText(null);
    setFailed(false);
    setCopied(false);
    fetch(path)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
      .then((record) => live && setText(record))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [open, path]);

  const copy = async () => {
    if (text === null) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    // Discord's frame cannot save files, so inside the Activity the record opens in the player's browser.
    if (inActivity) return openExternal(`${SITE_URL}${path}`);
    if (text === null) return;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ligungi-${gameId}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <button type="button" class="button button-empty text ligungi-export" data-icon={icons.Download} onClick={() => setOpen(true)}>
        {g.export}
      </button>
      {open && (
        <Modal title={g.exportTitle} onClose={() => setOpen(false)}>
          <p class="ligungi-export__help">{g.exportHelp}</p>
          {failed ? (
            <p class="error" role="alert">
              {t.genericError}
            </p>
          ) : (
            <textarea
              class="form-control ligungi-export__text"
              readOnly
              rows={12}
              spellcheck={false}
              aria-label={g.exportTitle}
              value={text ?? t.common.loading}
              onFocus={(event) => (event.target as HTMLTextAreaElement).select()}
            />
          )}
          <div class="ligungi-export__actions">
            <button type="button" class="button" disabled={text === null} onClick={() => void copy()}>
              {copied ? g.exportCopied : g.exportCopy}
            </button>
            <button type="button" class="button button-empty text" disabled={text === null && !inActivity} data-icon={icons.Download} onClick={download}>
              {g.exportDownload}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
};
