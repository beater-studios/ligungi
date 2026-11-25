import {
  type ChallengePolicy,
  type FollowPolicy,
} from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../../api.ts';
import { OptionCards } from '../../components/ui.tsx';
import { useT } from '../../i18n/index.ts';
import { icons } from '../../icons.ts';

type PrivacyChoices = { readonly challengePolicy: ChallengePolicy; readonly followPolicy: FollowPolicy };

export const PrivacySettings = () => {
  const t = useT();
  const [choices, setChoices] = useState<PrivacyChoices | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    api
      .get<PrivacyChoices>('/api/account/settings')
      .then(setChoices)
      .catch((err: Error) => setMessage({ ok: false, text: err.message }));
  }, []);

  const change = async (patch: Partial<PrivacyChoices>) => {
    const previous = choices;
    setChoices((current) => current && { ...current, ...patch });
    setMessage(null);
    try {
      setChoices(await api.post<PrivacyChoices>('/api/account/settings', patch));
      setMessage({ ok: true, text: t.account.challengesSaved });
    } catch (err) {
      setChoices(previous);
      setMessage({ ok: false, text: (err as Error).message });
    }
  };

  const options = [
    { value: 'everyone' as const, label: t.account.policyEveryone },
    { value: 'following' as const, label: t.account.policyFollowing },
    { value: 'nobody' as const, label: t.account.policyNobody },
  ];
  return (
    <form class="form3" onSubmit={(e) => e.preventDefault()}>
      {choices && (
        <>
          <OptionCards
            name="acc-challenges"
            legend={t.account.challengesTitle}
            layout="segmented"
            value={choices.challengePolicy}
            options={options}
            onChange={(challengePolicy) => void change({ challengePolicy })}
            help={t.account.challengesText}
          />
          <OptionCards
            name="acc-followers"
            legend={t.account.followTitle}
            layout="segmented"
            value={choices.followPolicy}
            options={options}
            onChange={(followPolicy) => void change({ followPolicy })}
            help={t.account.followText}
          />
        </>
      )}
      {message && <p class={message.ok ? 'ligungi-success' : 'error'} role="status">{message.text}</p>}
    </form>
  );
};

/** The players this account blocked, each with a link to their profile and a button to unblock. */
export const BlockedPlayers = () => {
  const t = useT();
  const [names, setNames] = useState<readonly string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .get<string[]>('/api/account/blocks')
      .then(setNames)
      .catch((err: Error) => setError(err.message));
  }, []);

  const unblock = async (name: string) => {
    setError(null);
    try {
      await api.delete(`/api/users/${encodeURIComponent(name)}/block`);
      setNames((current) => current && current.filter((other) => other !== name));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <>
      <h2>{t.account.blockedTitle}</h2>
      <p>{t.account.blockedText}</p>
      {names && names.length === 0 && <p>{t.account.blockedEmpty}</p>}
      {names && names.length > 0 && (
        <ul class="ligungi-blocked">
          {names.map((name) => (
            <li key={name}>
              <a href={`/@/${encodeURIComponent(name)}`}>{name}</a>
              <button type="button" class="button button-empty text" data-icon={icons.X} onClick={() => void unblock(name)}>
                {t.account.unblock}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p class="error" role="status">{error}</p>}
    </>
  );
};
