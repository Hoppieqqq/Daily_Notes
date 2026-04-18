import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  outfile: 'main.js',
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  external: ['obsidian', 'electron', '@electron/remote'],
  logLevel: 'info'
});

if (watch) {
  await context.watch();
  console.log('[daily-floating-note] watching...');
} else {
  await context.rebuild();
  await context.dispose();
  console.log('[daily-floating-note] build completed');
}
