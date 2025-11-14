import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';

const watchMode = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/script.js'],
  bundle: true,
  outfile: 'script.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  sourcemap: false,
  minify: false,
  define: {
    'process.env.NODE_ENV': '"production"'
  }
};

async function build() {
  try {
    if (watchMode) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('Watching for changes...');
    } else {
      await esbuild.build(buildOptions);
      console.log('Build complete!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
