import { prefs } from './prefs.ts';

/**
 * Sounds from lila's "sfx" set by Enigmahack (AGPLv3+, see lila's COPYING.md), bundled from src/assets/sound so
 * they get content-hashed names and long-lived caching. lila's default "standard" set is not free, so it is not used.
 */
const URLS = import.meta.glob<string>('./assets/sound/*.{ogg,mp3}', { query: '?url', import: 'default', eager: true });
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
} as const;

export type SoundName = keyof typeof FILES;

const extension = (() => {
  try {
    return new Audio().canPlayType('audio/ogg; codecs=vorbis') ? 'ogg' : 'mp3';
  } catch {
    return 'mp3';
  }
})();

const cache = new Map<SoundName, HTMLAudioElement>();

export const playSound = (name: SoundName): void => {
  if (!prefs.get().sound) return;
  try {
    let audio = cache.get(name);
    if (!audio) {
      audio = new Audio(URLS[`./assets/sound/${FILES[name]}.${extension}`]);
      audio.preload = 'auto';
      cache.set(name, audio);
    }
    const instance = audio.paused ? audio : (audio.cloneNode() as HTMLAudioElement);
    instance.currentTime = 0;
    void instance.play().catch(() => undefined);
  } catch {
    /* Audio unavailable (e.g. blocked autoplay): ignore. */
  }
};
