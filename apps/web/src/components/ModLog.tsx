import type { ModLogEntry } from '@ligungi/protocol';
import { formatDate, useT } from '../i18n/index.ts';

/** Lines of the moderation log, newest first: when, who, what and on whom, with the details as written. */
export const ModLog = ({ entries }: { entries: readonly ModLogEntry[] }) => {
  const t = useT();
  if (entries.length === 0) return <p class="ligungi-notice">{t.mod.noLog}</p>;
  return (
    <ol class="ligungi-mod-log">
      {entries.map((entry) => (
        <li key={entry.id}>
          <span class="ligungi-mod-log__head">
            <strong>{t.mod.actions[entry.action]}</strong>
            {entry.target && (
              <>
                {' · '}
                <a href={`/@/${entry.target}`}>{entry.target}</a>
              </>
            )}
            {entry.gameId && (
              <>
                {' · '}
                <a href={`/${entry.gameId}`}>{entry.gameId}</a>
              </>
            )}
          </span>
          {entry.details && <span class="ligungi-mod-log__details">{entry.details}</span>}
          <small>
            {entry.moderator} · {formatDate(t, entry.createdAt)}
          </small>
        </li>
      ))}
    </ol>
  );
};
