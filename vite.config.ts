import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';
import { copyFileSync } from 'fs';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    preact(),
    crx({ manifest }),
    {
      name: 'copy-files',
      closeBundle() {
        // Copy auth-callback files (not handled by CRXJS)
        copyFileSync('auth-callback.html', 'dist/auth-callback.html');
        copyFileSync('auth-callback.js', 'dist/auth-callback.js');
        // Copy markdown-parser.js to dist
        copyFileSync('markdown-parser.js', 'dist/markdown-parser.js');
      },
    },
  ],
  build: {
    minify: false, // Disable minification for easier debugging
    modulePreload: false, // Disable module preload polyfill (breaks in service workers)
    rollupOptions: {
      output: {
        // Disable dynamic import polyfill for service workers
        inlineDynamicImports: false,
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
