import * as esbuild from 'esbuild';
import { mkdirSync, existsSync } from 'fs';

const watchMode = process.argv.includes('--watch');

// Ensure dist directory exists
if (!existsSync('dist')) {
  mkdirSync('dist');
}

// Build supabase.js separately (with dependencies bundled)
const supabaseBuildOptions = {
  entryPoints: ['src/supabase.js'],
  bundle: true,
  outfile: 'dist/supabase.js',
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  sourcemap: false,
  minify: false,
  define: {
    'process.env.NODE_ENV': '"production"'
  }
};

// Build script.js (which imports from supabase.js)
const scriptBuildOptions = {
  entryPoints: ['src/script.js'],
  bundle: true,
  outfile: 'dist/script.js',
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  sourcemap: false,
  minify: false,
  external: ['./supabase.js'], // Don't bundle supabase.js, it's separate
  define: {
    'process.env.NODE_ENV': '"production"'
  }
};

async function build() {
  try {
    if (watchMode) {
      console.log('Building supabase.js...');
      await esbuild.build(supabaseBuildOptions);
      console.log('Watching script.js for changes...');
      const ctx = await esbuild.context(scriptBuildOptions);
      await ctx.watch();
    } else {
      console.log('Building supabase.js...');
      await esbuild.build(supabaseBuildOptions);
      console.log('Building script.js...');
      await esbuild.build(scriptBuildOptions);
      console.log('Build complete! Output in dist/ folder');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
