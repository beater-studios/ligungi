import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Generates vendor/lila/ui/lib/css/theme/gen/_wrap.scss: one `$c-name: var(--c-name);` per theme
 * color variable, the same step lila's build performs before compiling its SCSS.
 */
const themeDir = join(dirname(fileURLToPath(import.meta.url)), '../vendor/lila/ui/lib/css/theme');
const variables = new Set();
for (const file of readdirSync(themeDir)) {
  if (!file.startsWith('_') || !file.includes('theme.') || !file.endsWith('.scss')) continue;
  for (const line of readFileSync(join(themeDir, file), 'utf8').split('\n')) {
    if (!line.includes('--c-')) continue;
    const comment = line.indexOf('//');
    if (comment !== -1 && comment < line.indexOf(':')) continue;
    variables.add(line.split(':')[0].trim().replace('--', ''));
  }
}
const output = [...variables].sort().map((name) => `$${name}: var(--${name});`).join('\n') + '\n';
mkdirSync(join(themeDir, 'gen'), { recursive: true });
writeFileSync(join(themeDir, 'gen', '_wrap.scss'), output);
console.log(`lila-wrap: ${variables.size} theme variables`);
