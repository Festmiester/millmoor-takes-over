// Package the existing Worker and small static client for multipart API deployment.
// No credentials are included. Normal Wrangler asset deployment remains supported.
import { readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';
const assets = {};
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
function walk(dir, prefix = '') {
  for (const file of readdirSync(dir)) {
    const full = `${dir}/${file}`, path = `${prefix}/${file}`;
    if (statSync(full).isDirectory()) walk(full, path);
    else if (file !== '_headers') assets[path] = { body: readFileSync(full, 'utf8'), type: mime[file.slice(file.lastIndexOf('.'))] || 'text/plain' };
  }
}
walk('dist');
const headerText = readFileSync('public/_headers', 'utf8');
const headers = Object.fromEntries(headerText.split('\n').filter(l => /^\s+[^:]+:/.test(l)).map(l => {const i=l.indexOf(':');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
mkdirSync('.wrangler/plugin', { recursive: true });
await build({ stdin: { contents: `import worker from './server/worker.ts';
const assets = ${JSON.stringify(assets)};
const securityHeaders = ${JSON.stringify(headers)};
export default {fetch(request, env, ctx) {return worker.fetch(request, {...env, ASSETS: {fetch: async r => {
const p = new URL(r.url).pathname;
const asset = assets[p === '/' ? '/index.html' : p];
if (!asset) return new Response('Not found', {status:404});
return new Response(r.method === 'HEAD' ? null : asset.body, {headers:{...securityHeaders,'Content-Type':asset.type,'Cache-Control':p.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache'}});
}}}, ctx);}};`, resolveDir: process.cwd(), sourcefile: 'plugin-entry.ts' }, bundle: true, minify: true, format: 'esm', platform: 'browser', target: 'es2022', outfile: '.wrangler/plugin/worker.js', external: ['node:*', 'cloudflare:*'] });
console.log('Packaged credential-free Worker and static client');
