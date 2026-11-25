import { useT } from '../i18n/index.ts';
import type { RunRecords } from './puzzleRuns.ts';

/** The best result of today, of the last 7 days and ever, of the puzzle runs and of Puzzle Racer. */
export const Records = ({ records }: { records: RunRecords }) => {
  const t = useT();
  return (
    <dl class="ligungi-run__records" aria-label={t.puzzleRuns.records}>
      <div>
        <dt>{t.puzzleRuns.today}</dt>
        <dd>{records.today}</dd>
      </div>
      <div>
        <dt>{t.puzzleRuns.week}</dt>
        <dd>{records.week}</dd>
      </div>
      <div>
        <dt>{t.puzzleRuns.ever}</dt>
        <dd>{records.ever}</dd>
      </div>
    </dl>
  );
};
