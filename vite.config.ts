import copy from 'rollup-plugin-copy';
import { defineConfig } from 'vite';

const s_MODULE_ID = 'gm-screen';
const s_PACKAGE_ID = `modules/${s_MODULE_ID}`;
const S_MODULE_FULLNAME = 'foundryvtt-gmScreen';
const s_ENTRY_TYPESCRIPT = `${S_MODULE_FULLNAME}.ts`;

export default defineConfig({
  root: 'src/', // Source location / esbuild root.
  base: `/${s_PACKAGE_ID}/`, // Base module path that 30001 / served dev directory.
  publicDir: false, // No public resources to copy.
  cacheDir: '../.vite-cache', // Relative from root directory.
  server: {
    port: 29999,
    open: '/game',
    strictPort: true, // Prevents switching to a different port if 29999 is unavailable
    // open: false,
    watch: {
      usePolling: true, // Ensures file changes are detected
    },
    proxy: {
      // Serves static files from main Foundry server.
      [`^(/${s_PACKAGE_ID}/(images|fonts|assets|lang|languages|packs|styles|templates|${S_MODULE_FULLNAME}.css))`]:
        'http://127.0.0.1:30000',

      // All other paths besides package ID path are served from main Foundry server.
      [`^(?!/${s_PACKAGE_ID}/)`]: 'http://127.0.0.1:30000',

      // Enable socket.io from main Foundry server.
      '/socket.io': { target: 'ws://127.0.0.1:30000', ws: true },
    },
  },
  build: {
    outDir: `../dist/${s_MODULE_ID}`,
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      name: S_MODULE_FULLNAME,
      entry: s_ENTRY_TYPESCRIPT,
      formats: ['es'],
      cssFileName: S_MODULE_FULLNAME,
    },
    rollupOptions: {
      output: {
        entryFileNames: `${S_MODULE_FULLNAME}.js`,
        format: 'es',
      },
    },
  },
  plugins: [
    copy({
      targets: [
        { src: 'src/lang', dest: `./dist/${s_MODULE_ID}` },
        { src: 'src/templates', dest: `./dist/${s_MODULE_ID}` },
        { src: 'src/module.json', dest: `./dist/${s_MODULE_ID}` },
      ],
      hook: 'writeBundle',
    }),
  ],
});
