import {
  COUNTRIES,
  PROFILE_BIO_MAX,
  PROFILE_LINKS,
  PROFILE_SITES,
  profileLinkName,
  type Country,
  type ProfileDetails,
  type ProfileSite,
} from '@ligungi/protocol';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { api } from '../../api.ts';
import { SiteIcon } from '../../components/ProfileAbout.tsx';
import { Field, Select, SubmitButton } from '../../components/ui.tsx';
import { countryName, errorText, useT } from '../../i18n/index.ts';
import { SITE_NAMES } from '../../profileSites.ts';

type LinkDrafts = Record<ProfileSite, string>;

const drafts = (details: ProfileDetails): LinkDrafts =>
  Object.fromEntries(PROFILE_SITES.map((site) => [site, details.links[site] ?? ''])) as LinkDrafts;

/**
 * Bio, country and linked profiles. Each link is only the name on that site, typed after the fixed part of its address,
 * so a profile can only point to the listed sites.
 */
export const ProfileForm = () => {
  const t = useT();
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState<Country | null>(null);
  const [links, setLinks] = useState<LinkDrafts | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const countries = useMemo(() => [...COUNTRIES].sort((a, b) => countryName(t, a).localeCompare(countryName(t, b), t.locale)), [t.locale]);
  const fill = (details: ProfileDetails) => {
    setBio(details.bio);
    setCountry(details.country);
    setLinks(drafts(details));
  };
  useEffect(() => {
    api
      .get<ProfileDetails>('/api/account/profile')
      .then(fill)
      .catch((err: Error) => setMessage({ ok: false, text: err.message }));
  }, []);

  if (!links) return message ? <p class="error">{message.text}</p> : null;
  const invalid = (site: ProfileSite) => links[site].trim() !== '' && profileLinkName(site, links[site]) === null;
  const used = [...bio].length;

  const submit = async (event: Event) => {
    event.preventDefault();
    if (PROFILE_SITES.some(invalid) || used > PROFILE_BIO_MAX) return;
    setBusy(true);
    setMessage(null);
    try {
      fill(await api.post<ProfileDetails>('/api/account/profile', { bio, country, links }));
      setMessage({ ok: true, text: t.account.profileSaved });
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const gameNames: Partial<Record<ProfileSite, string>> = t.account.gameNames;
  const group = (kind: 'social' | 'games', title: string) => (
    <fieldset class="ligungi-profile-form__links">
      <legend>{title}</legend>
      {PROFILE_SITES.filter((site) => PROFILE_LINKS[site].group === kind).map((site) => (
        <Field
          key={site}
          label={
            <>
              <SiteIcon site={site} /> {gameNames[site] ? `${gameNames[site]} (${SITE_NAMES[site]})` : SITE_NAMES[site]}
            </>
          }
          htmlFor={`acc-link-${site}`}
          help={invalid(site) ? <span class="error">{t.account.linkInvalid}</span> : undefined}
        >
          <div class="ligungi-prefixed">
            <span class="ligungi-prefixed__prefix" aria-hidden="true">
              {PROFILE_LINKS[site].prefix}
            </span>
            <input
              id={`acc-link-${site}`}
              class="form-control"
              autocomplete="off"
              spellcheck={false}
              maxLength={300}
              aria-invalid={invalid(site)}
              value={links[site]}
              onInput={(e) => setLinks({ ...links, [site]: (e.target as HTMLInputElement).value })}
            />
          </div>
        </Field>
      ))}
    </fieldset>
  );

  return (
    <form class="form3 ligungi-profile-form" onSubmit={submit}>
      <p>{t.account.profileText}</p>
      <Field
        label={t.account.bio}
        htmlFor="acc-bio"
        help={used > PROFILE_BIO_MAX ? <span class="error">{errorText(t, 'bioTooLong')}</span> : t.account.bioHelp(used, PROFILE_BIO_MAX)}
      >
        <textarea
          id="acc-bio"
          class="form-control"
          rows={4}
          aria-invalid={used > PROFILE_BIO_MAX}
          value={bio}
          onInput={(e) => setBio((e.target as HTMLTextAreaElement).value)}
        />
      </Field>
      <Field label={t.account.country} htmlFor="acc-country">
        <Select
          id="acc-country"
          value={country}
          options={[{ value: null, label: t.account.noCountry }, ...countries.map((code) => ({ value: code, label: countryName(t, code) }))]}
          onChange={setCountry}
        />
      </Field>
      <p class="ligungi-profile-form__help">{t.account.linksHelp}</p>
      <div class="ligungi-profile-form__groups">
        {group('social', t.account.socialTitle)}
        {group('games', t.account.otherGamesTitle)}
      </div>
      {message && <p class={message.ok ? 'ligungi-success' : 'error'}>{message.text}</p>}
      <SubmitButton disabled={busy}>{t.account.profileSave}</SubmitButton>
    </form>
  );
};
