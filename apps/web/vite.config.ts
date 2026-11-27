import { defaultClientConditions, defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { buildCommit, buildVersion } from '../../scripts/build-info.ts';
import { offeredLanguages } from './scripts/languages.ts';

const server = process.env.LIGUNGI_SERVER ?? 'http://localhost:4000';
const locales = fileURLToPath(new URL('./src/i18n/locales', import.meta.url));

export default defineConfig(({ isSsrBuild }) => ({
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  define: {
    __LIGUNGI_VERSION__: JSON.stringify(buildVersion()),
    __LIGUNGI_COMMIT__: JSON.stringify(buildCommit()),
    __LIGUNGI_LANGUAGES__: JSON.stringify(offeredLanguages(locales).map(({ code, locale, name }) => ({ code, locale, name }))),
  },
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'mixed-decls', 'slash-div'],
      },
    },
  },
  server: {
    proxy: {
      '/api': { target: server, changeOrigin: false },
      '/ws': { target: server.replace(/^http/, 'ws'), ws: true, changeOrigin: false },
    },
  },
  worker: { format: 'es' },
  // onnxruntime-web's extern-wasm build loads its runtime files from the URLs the Komugi worker passes it (the
  // files scripts/komugi-assets.sh installs), instead of bundling them. Pre-bundling would skip this condition.
  resolve: { conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions] },
  optimizeDeps: { exclude: ['onnxruntime-web', '@komugi-ai/engine'] },
  // The SSR build only feeds scripts/prerender.ts: bundle everything (workspace packages are TypeScript sources).
  ssr: { noExternal: true },
  build: { copyPublicDir: !isSsrBuild },
}));
