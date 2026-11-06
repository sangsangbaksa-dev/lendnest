const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function worker(hit,fetchFn){
 const handlers={},waits=[],put=[];
 vm.runInNewContext(fs.readFileSync(require.resolve('../app/sw.js'),'utf8'),{
  URL,fetch:fetchFn,caches:{open:async()=>({match:async()=>hit,put:async(...args)=>put.push(args)})},
  self:{location:{origin:'https://lendnest.test'},addEventListener:(name,fn)=>handlers[name]=fn}
 });
 function request(url='https://lendnest.test/app/core.js',method='GET'){
  let response;handlers.fetch({request:{url,method},waitUntil:p=>waits.push(p),respondWith:p=>response=p});
  return response;
 }
 return {request,waits,put};
}
test('offline revalidation keeps a cached response and settles its background work',async()=>{
 const hit={cached:true};const w=worker(hit,async()=>{throw new Error('offline')});
 assert.equal(await w.request(),hit);await Promise.all(w.waits);
 assert.equal(w.waits.length,1);
});
test('successful revalidation stores a fresh response for the next opening',async()=>{
 const fresh={ok:true,clone(){return this}};const w=worker(null,async()=>fresh);
 assert.equal(await w.request(),fresh);await Promise.all(w.waits);assert.equal(w.put.length,1);
});
test('license and external requests stay outside the offline cache',()=>{
 const w=worker(null,()=>{throw new Error('must not fetch')});
 assert.equal(w.request('https://lendnest.test/api/license'),undefined);
 assert.equal(w.request('https://other.test/file.js'),undefined);
 assert.equal(w.request('https://lendnest.test/app/core.js','POST'),undefined);
 assert.equal(w.waits.length,0);
});
