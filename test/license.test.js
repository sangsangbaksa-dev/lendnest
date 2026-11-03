/* Cloudflare Pages Function functions/api/license.js (activation of a paid Lendnest key). Outbound calls are faked. */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path');
const root = path.join(__dirname, '..');
let onRequest;
test.before(async () => {
  const src = fs.readFileSync(path.join(root, 'functions/api/license.js'), 'utf8').replace("'../../lib/license-core.js'", JSON.stringify(path.join(root, 'lib/license-core.js')));
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lnfn-')), 'license.mjs'); fs.writeFileSync(f, src);
  ({ onRequest } = await import('file://' + f));
});
const req = (body, method = 'POST') => new Request('https://x.test/api/license', { method, body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined, headers: { 'content-type': 'application/json' } });
const run = async (r, env) => { const res = await onRequest({ request: r, env }); return { status: res.status, body: await res.json(), headers: res.headers }; };
const reply = (json, status = 200) => { global.fetch = async () => ({ status, json: async () => json }); };
const ENV = { LEMONSQUEEZY_PRODUCT_ID: 'prod-1' };

test('unconfigured server answers configured:false without calling out', async () => {
  global.fetch = async () => { throw new Error('no call'); };
  assert.deepEqual((await run(req({ key: 'ABCD-1234-EFGH' }), { LEMONSQUEEZY_DISABLED: '1' })).body, { configured: false });
});
test('GET is 405 with Allow: POST', async () => { const r = await run(req(null, 'GET'), ENV); assert.equal(r.status, 405); assert.equal(r.headers.get('allow'), 'POST'); });
test('malformed or oversized bodies are 400 and never call out', async () => {
  global.fetch = async () => { throw new Error('no call'); };
  assert.equal((await run(req('{not json'), ENV)).status, 400); assert.equal((await run(req({ key: 'A'.repeat(5000) }), ENV)).status, 400);
});
test('activates a key for our product only', async () => {
  reply({ valid: true, license_key: { status: 'active' }, meta: { product_id: 'prod-1' } });
  const ok = await run(req({ action: 'activate', key: 'ABCD-1234-EFGH' }), ENV); assert.deepEqual(ok.body, { configured: true, ok: true, instanceId: '' });
  reply({ valid: true, license_key: { status: 'disabled' }, meta: { product_id: 'prod-1' } }); assert.equal((await run(req({ key: 'ABCD-1234-EFGH' }), ENV)).body.reason, 'refunded');
  reply({ valid: true, license_key: { status: 'active' }, meta: { product_id: 'other' } }); assert.equal((await run(req({ key: 'ABCD-1234-EFGH' }), ENV)).body.ok, false);
});
test('provider outage is 502 unreachable', async () => { global.fetch = async () => { throw new Error('down'); }; const r = await run(req({ key: 'ABCD-1234-EFGH' }), ENV); assert.equal(r.status, 502); assert.equal(r.body.reason, 'unreachable'); });
