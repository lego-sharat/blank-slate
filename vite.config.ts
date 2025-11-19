import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    preact(),
    {
      name: 'copy-files',
      closeBundle() {
        // Copy manifest.json to dist
        copyFileSync('manifest.json', 'dist/manifest.json');
        // Copy auth-callback.js to dist
        copyFileSync('auth-callback.js', 'dist/auth-callback.js');
        // Copy markdown-parser.js to dist
        copyFileSync('markdown-parser.js', 'dist/markdown-parser.js');
      },
    },
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        newtab: resolve(__dirname, 'newtab.html'),
        'auth-callback': resolve(__dirname, 'auth-callback.html'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        manualChunks(id) {
          // Isolate chunks by entry point to prevent sharing code between
          // background (service worker) and newtab (browser window)

          // Don't create chunks from node_modules - inline them
          if (id.includes('node_modules')) {
            return undefined; // Let Rollup bundle with importer
          }

          // historyTracker and its dependencies should be a separate chunk
          // that's only loaded when needed (not at background startup)
          if (id.includes('src/utils/historyTracker') ||
              id.includes('src/utils/figmaApi') ||
              id.includes('src/utils/urlCleaner')) {
            return 'historyTracker';
          }

          // Don't create any other shared chunks - inline with entry point
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@store': resolve(__dirname, './src/store'),
      '@utils': resolve(__dirname, './src/utils'),
    },
  },
});
