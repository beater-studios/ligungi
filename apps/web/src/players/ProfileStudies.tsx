import type { StudyList, StudyListItem } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { timeAgo, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';

/** How many of a player's studies the profile shows before the link to all of them. */
const SHOWN = 6;

/** A player's public studies, latest changed first, with a link to the list filtered by them. Nothing when there are none. */
export const ProfileStudies = ({ name }: { name: string }) => {
  const t = useT();
  const [list, setList] = useState<{ studies: readonly StudyListItem[]; more: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    setList(null);
    api
      .get<StudyList>(`/api/studies?author=${encodeURIComponent(name)}`)
      .then((result) => alive && setList(result))
      .catch(() => alive && setList({ studies: [], more: false }));
    return () => {
      alive = false;
    };
  }, [name]);
  if (!list || list.studies.length === 0) return null;
  const all = `/study?author=${encodeURIComponent(name)}`;
  return (
    <section class="ligungi-card ligungi-profile-studies">
      <div class="ligungi-profile-studies__head">
        <h2>{t.profile.studiesTitle}</h2>
        {(list.more || list.studies.length > SHOWN) && (
          <a class="text" href={all}>
            {t.profile.allStudies}
          </a>
        )}
      </div>
      <ul class="ligungi-profile-studies__list">
        {list.studies.slice(0, SHOWN).map((study) => (
          <li key={study.id}>
            <a href={`/study/${study.id}`}>
              <strong>{study.title}</strong>
              <span class="ligungi-profile-studies__meta">
                <span>{t.study.chapterCount(study.chapters)}</span>
                {study.likes > 0 && (
                  <span class="ligungi-studies__likes" data-icon={icons.Heart}>
                    {t.study.likeCount(study.likes)}
                  </span>
                )}
                <span>{timeAgo(t, study.updatedAt)}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};
