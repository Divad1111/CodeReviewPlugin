const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !isProduction,
  minify: isProduction,
  // sql.js WASM needs to be copied separately
  loader: { '.wasm': 'file' },
};

async function copyWasm() {
  const wasmSrc = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const wasmDst = path.join(__dirname, 'out', 'sql-wasm.wasm');
  if (fs.existsSync(wasmSrc)) {
    fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
    fs.copyFileSync(wasmSrc, wasmDst);
    console.log('Copied sql-wasm.wasm to out/');
  }
}

async function main() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    await copyWasm();
    console.log('Watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    await copyWasm();
    console.log('Build complete.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
