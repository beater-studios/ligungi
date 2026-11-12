import { ANALYTICS_AVAILABLE, consent, setConsent } from '../consent.ts';
import { useT } from '../i18n/index.ts';
import { useLocation } from '../router.ts';
import { useStore } from '../store.ts';

export const CookieBanner = () => {
  const t = useT();
  const choice = useStore(consent);
  const { path } = useLocation();
  // On the privacy page the preferences block below the policy does the same job.
  if (!ANALYTICS_AVAILABLE || choice !== null || path === '/privacy') return null;
  return (
    <div class="ligungi-consent" role="dialog" aria-live="polite" aria-label={t.consent.title}>
      <div class="ligungi-consent__text">
        <strong>{t.consent.title}</strong>
        <p>{t.consent.text}</p>
      </div>
      <div class="ligungi-consent__actions">
        <button type="button" class="button button-empty" onClick={() => setConsent('rejected')}>
          {t.consent.reject}
        </button>
        <button type="button" class="button" onClick={() => setConsent('accepted')}>
          {t.consent.accept}
        </button>
      </div>
    </div>
  );
};

export const CookiePreferences = () => {
  const t = useT();
  const choice = useStore(consent);
  if (!ANALYTICS_AVAILABLE) return null;
  const status = choice === 'accepted' ? t.consent.accepted : choice === 'rejected' ? t.consent.rejected : t.consent.undecided;
  return (
    <section id="cookies" class="ligungi-consent-prefs">
      <h2>{t.consent.prefsTitle}</h2>
      <p>{t.consent.prefsText}</p>
      <p>
        <strong>{t.consent.statusLabel}:</strong> {status}
      </p>
      <div class="ligungi-consent__actions">
        <button type="button" class="button button-empty" disabled={choice === 'rejected'} onClick={() => setConsent('rejected')}>
          {t.consent.reject}
        </button>
        <button type="button" class="button" disabled={choice === 'accepted'} onClick={() => setConsent('accepted')}>
          {t.consent.accept}
        </button>
      </div>
    </section>
  );
};
