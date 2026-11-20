import { prefs, type SoundSet } from './prefs.ts';

/**
 * Sounds from lila's "sfx", "piano", "futuristic" and "nes" sets by Enigmahack (AGPLv3+, see lila's COPYING.md), one
 * folder per set in src/assets/sound, bundled so they get content-hashed names and long-lived caching. Only the chosen
 * set is ever downloaded, sound by sound as it plays. lila's default "standard" set is not free, so it is not used,
 * and neither is its error sound, which the free sets only link to.
 */
const URLS = import.meta.glob<string>('./assets/sound/*/*.{ogg,mp3}', { query: '?url', import: 'default', eager: true });
const FILES = {
  move: 'Move',
  capture: 'Capture',
  notify: 'GenericNotify',
  lowtime: 'LowTime',
  error: 'GenericNotify',
  victory: 'Victory',
  defeat: 'Defeat',
  draw: 'Draw',
  challenge: 'NewChallenge',
  check: 'Check',
} as const;

export type SoundName = keyof typeof FILES;

const extension = (() => {
  try {
    return new Audio().canPlayType('audio/ogg; codecs=vorbis') ? 'ogg' : 'mp3';
  } catch {
    return 'mp3';
  }
})();

/** A file of the chosen set, or of the default one should a set lack it. */
const urlOf = (set: SoundSet, file: string): string | undefined =>
  URLS[`./assets/sound/${set}/${file}.${extension}`] ?? URLS[`./assets/sound/sfx/${file}.${extension}`];

const cache = new Map<string, HTMLAudioElement>();

const playFile = (file: string): void => {
  if (!prefs.get().sound) return;
  try {
    const set = prefs.get().soundSet;
    const key = `${set}/${file}`;
    let audio = cache.get(key);
    if (!audio) {
      const url = urlOf(set, file);
      if (!url) return;
      audio = new Audio(url);
      audio.preload = 'auto';
      cache.set(key, audio);
    }
    const instance = audio.paused ? audio : (audio.cloneNode() as HTMLAudioElement);
    instance.currentTime = 0;
    void instance.play().catch(() => undefined);
  } catch {
    /* Audio unavailable (e.g. blocked autoplay): ignore. */
  }
};

/** Says a short text with the browser's own voice (Web Speech API), in `locale`, when sounds are on; silent where unsupported. */
export const speak = (text: string, locale: string): void => {
  if (!prefs.get().sound) return;
  try {
    if (typeof speechSynthesis === 'undefined') return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    utterance.rate = 1.2;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  } catch {
    /* Speech unavailable: ignore. */
  }
};

export const playSound = (name: SoundName): void => playFile(FILES[name]);

/**
 * One second of the countdown of the chosen set, from 10 down to 0. The "nes" set has one beat for 10 to 6 and a faster
 * one for 5 to 1, as lila links them.
 */
export const playCountdown = (second: number): void => {
  const n = Math.max(0, Math.min(10, Math.round(second)));
  if (prefs.get().soundSet === 'nes' && n > 0) playFile(n > 5 ? 'CountDownSlow' : 'CountDownFast');
  else playFile(`CountDown${n}`);
};
