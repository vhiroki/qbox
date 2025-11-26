import { defineConfig } from 'vite';
import path from 'path';

// Vite config for Electron main process
export default defineConfig({
  resolve: {
    browserField: false,
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  build: {
    outDir: '.vite/build',
    lib: {
      entry: path.resolve(__dirname, 'electron/main.ts'),
      formats: ['cjs'],
      fileName: () => 'main.cjs',
    },
    rollupOptions: {
      external: [
        'electron',
        'child_process',
        'fs',
        'path',
        'os',
        'crypto',
        'events',
        'stream',
        'util',
        'assert',
        // Note: electron-squirrel-startup is NOT external - it needs to be bundled
      ],
    },
    minify: false,
    sourcemap: true,
  },
});

