import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Version and commit of a build, shared by the site (vite.config.ts) and the server. LIGUNGI_COMMIT wins because
 * Docker builds have no .git; elsewhere git answers directly.
 */
const git = (...args: string[]): string | null => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

export const buildVersion = (): string =>
  (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;

export const buildCommit = (): string => {
  if (process.env.LIGUNGI_COMMIT) return process.env.LIGUNGI_COMMIT;
  const commit = git('rev-parse', '--short', 'HEAD');
  if (!commit) return 'dev';
  return git('status', '--porcelain') ? `${commit}-dirty` : commit;
};
