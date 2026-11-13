import { defineConfig } from 'vite';
import { buildCommit, buildVersion } from '../../scripts/build-info.ts';

const server = process.env.LIGUNGI_SERVER ?? 'http://localhost:4000';

export default defineConfig(({ isSsrBuild }) => ({
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  define: {
    __LIGUNGI_VERSION__: JSON.stringify(buildVersion()),
    __LIGUNGI_COMMIT__: JSON.stringify(buildCommit()),
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
  // The SSR build only feeds scripts/prerender.ts: bundle everything (workspace packages are TypeScript sources).
  ssr: { noExternal: true },
  build: { copyPublicDir: !isSsrBuild },
}));
