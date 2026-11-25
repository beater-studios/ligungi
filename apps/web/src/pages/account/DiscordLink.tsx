import {
  DISCORD_LINK_RESULTS,
  DISCORD_TIERS,
  DISCORD_VERIFIED_ROLE,
  type DiscordLinkResult,
  type DiscordLinkView,
} from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../../api.ts';
import { useT } from '../../i18n/index.ts';
import { LINKS } from '../../i18n/content/shared.tsx';
import { navigate, useLocation } from '../../router.ts';

/**
 * The link to the community Discord server: the rank role the bot gives from the rating, the Linked Roles connection,
 * and what each rank asks for. The sign-in itself is a full page visit to Discord and back (`/api/discord/link`).
 */
export const DiscordLink = () => {
  const t = useT();
  const d = t.account.discord;
  const { search } = useLocation();
  const [view, setView] = useState<DiscordLinkView | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api
      .get<DiscordLinkView>('/api/account/discord')
      .then(setView)
      .catch(() => setView(null));
  }, []);
  useEffect(() => {
    const result = new URLSearchParams(search).get('discord');
    if (!result) return;
    const known = DISCORD_LINK_RESULTS.find((value): value is DiscordLinkResult => value === result);
    if (known) setMessage({ ok: known === 'linked', text: d.results[known] });
    // The result is shown once; reloading the page should not show it again.
    const rest = new URLSearchParams(search);
    rest.delete('discord');
    navigate(`/account${rest.size ? `?${rest}` : ''}`, true, false);
  }, [search]);

  if (!view?.enabled) return null;
  const act = async (request: () => Promise<DiscordLinkView>, done?: (next: DiscordLinkView) => string | null) => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await request();
      setView(next);
      const text = done?.(next) ?? null;
      if (text) setMessage({ ok: true, text });
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const link = view.link;
  const tier = link?.tier ? DISCORD_TIERS.find((entry) => entry.id === link.tier) : undefined;
  const range = (index: number) => {
    const entry = DISCORD_TIERS[index]!;
    const above = index > 0 ? DISCORD_TIERS[index - 1]!.min : null;
    if (entry.min === null) return d.rangeBelow(String(DISCORD_TIERS[index - 1]!.min ?? 0));
    return above === null ? d.rangeFrom(String(entry.min)) : d.rangeBetween(String(entry.min), String(above - 1));
  };

  return (
    <section class="ligungi-card ligungi-settings__card ligungi-discord-link" id="discord">
      <h2>{d.title}</h2>
      <p>{d.text}</p>
      {link ? (
        <>
          <p>
            <strong>{d.linked(link.discordName)}</strong>{' '}
            {tier ? d.rank(`${tier.kanji} ${tier.name}`) : d.verified(DISCORD_VERIFIED_ROLE)}
          </p>
          {link.paused && (
            <div class="ligungi-discord-link__paused">
              <p>{d.paused}</p>
              <a class="button button-empty" href={LINKS.discord} target="_blank" rel="noopener noreferrer">
                {d.join}
              </a>
            </div>
          )}
          <div class="ligungi-discord-link__actions">
            {link.paused && (
              <button
                type="button"
                class="button"
                disabled={busy}
                onClick={() => void act(() => api.post<DiscordLinkView>('/api/account/discord/check'), (next) => (next.link?.paused ? d.stillAway : d.back))}
              >
                {d.check}
              </button>
            )}
            <button type="button" class="button button-empty button-red" disabled={busy} onClick={() => void act(() => api.delete<DiscordLinkView>('/api/account/discord'), () => d.unlinked)}>
              {d.unlink}
            </button>
          </div>
        </>
      ) : (
        <a class="button" href="/api/discord/link">
          {d.link}
        </a>
      )}
      {message && <p class={message.ok ? 'ligungi-success' : 'error'}>{message.text}</p>}
      <h3>{d.ranksTitle}</h3>
      <p class="ligungi-discord-link__help">{d.ranksHelp(DISCORD_VERIFIED_ROLE)}</p>
      <table class="slist slist-pad">
        <thead>
          <tr>
            <th scope="col">{d.rankColumn}</th>
            <th scope="col">{d.ratingColumn}</th>
          </tr>
        </thead>
        <tbody>
          {DISCORD_TIERS.map((entry, index) => (
            <tr key={entry.id} class={entry.id === link?.tier ? 'ligungi-discord-link__current' : undefined}>
              <td>
                <span lang="ja">{entry.kanji}</span> {entry.name}
              </td>
              <td>{range(index)}</td>
            </tr>
          ))}
          <tr>
            <td>{DISCORD_VERIFIED_ROLE}</td>
            <td>{d.provisional}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
};
