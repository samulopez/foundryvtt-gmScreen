import { defineConfig } from 'vite';
import copy from 'rollup-plugin-copy';

const MODULE_ID = 'gm-screen';
const PACKAGE_ID = `modules/${MODULE_ID}`;
const MODULE_FULLNAME = 'foundryvtt-gmScreen';
const ENTRY_TYPESCRIPT = `${MODULE_FULLNAME}.ts`;

export default defineConfig({
  root: 'src/', // Source location / esbuild root.
  base: `/${PACKAGE_ID}/`, // Base module path that 30001 / served dev directory.
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
      [`^(/${PACKAGE_ID}/(images|fonts|assets|lang|languages|packs|styles|templates|${MODULE_FULLNAME}.css))`]:
        'http://127.0.0.1:30000',

      // All other paths besides package ID path are served from main Foundry server.
      [`^(?!/${PACKAGE_ID}/)`]: 'http://127.0.0.1:30000',

      // Enable socket.io from main Foundry server.
      '/socket.io': { target: 'ws://127.0.0.1:30000', ws: true },
    },
  },
  build: {
    outDir: `../dist/${MODULE_ID}`,
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      name: MODULE_FULLNAME,
      entry: ENTRY_TYPESCRIPT,
      formats: ['es'],
      cssFileName: MODULE_FULLNAME,
    },
    rollupOptions: {
      output: {
        entryFileNames: `${MODULE_FULLNAME}.js`,
        format: 'es',
      },
    },
  },
  plugins: [
    copy({
      targets: [
        { src: 'src/lang', dest: `./dist/${MODULE_ID}` },
        { src: 'src/templates', dest: `./dist/${MODULE_ID}` },
        { src: 'src/module.json', dest: `./dist/${MODULE_ID}` },
      ],
      hook: 'writeBundle',
    }),
  ],
});
