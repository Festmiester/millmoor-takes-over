import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {default:worker}=await import('../.wrangler/plugin/worker.js');
for(const [name,mime] of [['manager-portrait.webp','image/webp'],['oswald-latin.woff2','font/woff2'],['pt-sans-regular.woff2','font/woff2'],['pt-sans-bold.woff2','font/woff2']]){
 const response=await worker.fetch(new Request('https://test.example/'+name),{},{});
 assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),mime);
 assert.deepEqual(Buffer.from(await response.arrayBuffer()),readFileSync('public/'+name));
 console.log('PASS packaged asset bytes and MIME:',name);
}
