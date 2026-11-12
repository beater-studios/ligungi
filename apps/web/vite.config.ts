import { defineConfig } from 'vite';

const server = process.env.LIGUNGI_SERVER ?? 'http://localhost:4000';

export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
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
});
