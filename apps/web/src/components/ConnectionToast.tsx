import { useEffect, useRef, useState } from 'preact/hooks';
import { online } from '../connection.ts';
import { useT } from '../i18n/index.ts';
import { useStore } from '../store.ts';

const BACK_MS = 4000;

/**
 * Tells a page that is already open that the internet dropped, and that it came back. The live region stays in the
 * page, so screen readers announce both changes.
 */
export const ConnectionToast = () => {
  const t = useT();
  const isOnline = useStore(online);
  const [back, setBack] = useState(false);
  const wasOffline = useRef(!isOnline);
  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setBack(false);
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setBack(true);
    const timer = setTimeout(() => setBack(false), BACK_MS);
    return () => clearTimeout(timer);
  }, [isOnline]);
  const message = !isOnline ? t.connection.lost : back ? t.connection.back : null;
  return (
    <div class="ligungi-toast" role="status" aria-live="polite">
      {message && <div class={`ligungi-toast__box ligungi-toast__box--${isOnline ? 'good' : 'bad'}`}>{message}</div>}
    </div>
  );
};
