import { REPORT_DETAILS_MAX, type ModLogEntry, type ReportView } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { ModLog } from '../components/ModLog.tsx';
import { Field, SubmitButton } from '../components/ui.tsx';
import { formatDate, useT } from '../i18n/index.ts';
import { session } from '../session.ts';
import { useStore } from '../store.ts';

const ReportCard = ({ report, onClosed }: { report: ReportView; onClosed: () => void }) => {
  const t = useT();
  const [resolution, setResolution] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/mod/reports/${report.id}/close`, { resolution });
      onClosed();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <li class="ligungi-card ligungi-report">
      <div class="ligungi-report__head">
        <a class="ligungi-report__target" href={`/@/${report.target.name}`}>
          {report.target.name}
        </a>
        <span class="ligungi-report__reason">{t.report.reasons[report.reason]}</span>
      </div>
      {report.details && <p class="ligungi-report__details">{report.details}</p>}
      <p class="ligungi-report__meta">
        {t.mod.reportedBy(report.reporter.name, formatDate(t, report.createdAt))}
        {report.gameId && (
          <>
            {' · '}
            <a href={`/${report.gameId}`}>{t.mod.game}</a>
          </>
        )}
      </p>
      {report.status === 'closed' ? (
        <p class="ligungi-report__resolution">
          <strong>{t.mod.closedBy(report.closedBy ?? '', formatDate(t, report.closedAt ?? report.createdAt))}:</strong> {report.resolution}
        </p>
      ) : (
        <form class="form3" onSubmit={close}>
          <Field label={t.mod.resolution} htmlFor={`resolution-${report.id}`}>
            <input
              id={`resolution-${report.id}`}
              class="form-control"
              required
              maxLength={REPORT_DETAILS_MAX}
              value={resolution}
              onInput={(e) => setResolution((e.target as HTMLInputElement).value)}
            />
          </Field>
          {error && <p class="error">{error}</p>}
          <SubmitButton disabled={busy}>{t.mod.close}</SubmitButton>
        </form>
      )}
    </li>
  );
};

/** The moderators' page: reports to handle (open or closed) and the log of every moderation action. */
export const ModPage = () => {
  const t = useT();
  const { loaded, moderator } = useStore(session);
  const [tab, setTab] = useState<'open' | 'closed' | 'log'>('open');
  const [reports, setReports] = useState<ReportView[] | null>(null);
  const [log, setLog] = useState<ModLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    if (tab === 'log') {
      api.get<ModLogEntry[]>('/api/mod/log').then(setLog).catch((err: Error) => setError(err.message));
    } else {
      setReports(null);
      api.get<ReportView[]>(`/api/mod/reports?status=${tab}`).then(setReports).catch((err: Error) => setError(err.message));
    }
  };
  useEffect(() => {
    if (moderator) load();
  }, [tab, moderator]);

  if (loaded && !moderator) {
    return (
      <main class="ligungi-page ligungi-mod">
        <p class="ligungi-card ligungi-mod__denied">{t.errors.notModerator}</p>
      </main>
    );
  }

  const tabs = [
    ['open', `${t.mod.reports}: ${t.mod.open}`],
    ['closed', `${t.mod.reports}: ${t.mod.closed}`],
    ['log', t.mod.log],
  ] as const;

  return (
    <main class="ligungi-page ligungi-mod">
      <header class="ligungi-mod__head">
        <h1>{t.mod.title}</h1>
        <div class="ligungi-segmented" role="group" aria-label={t.mod.title}>
          {tabs.map(([value, label]) => (
            <button key={value} type="button" class={tab === value ? 'active' : ''} aria-pressed={tab === value} onClick={() => setTab(value)}>
              {label}
            </button>
          ))}
        </div>
      </header>
      {error && <p class="error">{error}</p>}
      {tab === 'log' ? (
        log && (
          <section class="ligungi-card ligungi-mod__log">
            <ModLog entries={log} />
          </section>
        )
      ) : reports === null ? null : reports.length === 0 ? (
        <p class="ligungi-card ligungi-mod__empty">{t.mod.noReports}</p>
      ) : (
        <ul class="ligungi-mod__reports">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} onClosed={load} />
          ))}
        </ul>
      )}
    </main>
  );
};
