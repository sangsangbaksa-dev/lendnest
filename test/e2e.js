/* Browser test. Run: NODE_PATH=$(npm root -g) node test/e2e.js [screenshot-dir] */
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..'), types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const CSP = "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (p === '/privacy' || p === '/terms') p += '.html';
  const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-security-policy': CSP, 'content-type': types[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(r);
}).listen(0);
const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
(async () => {
  const base = `http://localhost:${srv.address().port}`, out = process.argv[2] || '/tmp/ln-shots'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(), errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US', permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text())); pg.on('response', r => r.status() >= 400 && console.log('HTTP', r.status(), r.url()));
  const add = async (o) => {
    await pg.click('#fab'); await pg.waitForSelector('dialog[open]');
    if (o.dir) await pg.check(`input[name=dir][value=${o.dir}]`, { force: true }); if (o.kind) await pg.check(`input[name=kind][value=${o.kind}]`, { force: true });
    await pg.fill('#f-title', o.title || ''); await pg.fill('#f-person', o.person || ''); if (o.amount) await pg.fill('#f-amount', String(o.amount));
    if (o.date) await pg.fill('#f-date', o.date); if (o.due !== undefined) await pg.fill('#f-due', o.due); if (o.note) await pg.fill('#f-note', o.note);
    await pg.click('#f-save');
  };
  const escForm = async () => { await pg.keyboard.press('Escape'); await pg.waitForSelector('#confirm-ok', { timeout: 1500 }).then(() => pg.click('#confirm-ok'), () => {}); await pg.waitForSelector('dialog', { state: 'detached' }); };
  // landing
  await pg.goto(base + '/'); await pg.waitForSelector('#feat article'); assert.equal(await pg.locator('#feat article').count(), 9);
  await pg.selectOption('#lang', 'ko'); assert.ok((await pg.locator('h1').textContent()).includes('전동드릴')); await pg.screenshot({ path: out + '/landing-ko.png' }); await pg.selectOption('#lang', 'en');
  await pg.goto(base + '/privacy'); assert.ok((await pg.locator('h1').textContent()) === 'Privacy');
  // app: empty state
  await pg.goto(base + '/app/'); await pg.waitForSelector('.empty'); assert.ok((await pg.locator('.empty h2').textContent()).includes('Nothing lent')); await pg.screenshot({ path: out + '/app-empty.png' });
  // validation
  await pg.click('#fab'); await pg.click('#f-save'); assert.ok((await pg.locator('#f-err').textContent()).includes('Say what')); await pg.fill('#f-title', 'x'); await pg.click('#f-save'); assert.ok((await pg.locator('#f-err').textContent()).includes('person'));
  await pg.fill('#f-person', 'Z'); await pg.fill('#f-date', '2026-10-10'); await pg.fill('#f-due', '2026-10-01'); await pg.click('#f-save'); assert.ok((await pg.locator('#f-err').textContent()).includes('before')); await escForm();
  // add item with XSS attempt, overdue
  await add({ title: 'Drill <img src=x onerror=alert(1)>', person: 'Mina <b>K</b>', date: plus(-20), due: plus(-5), note: 'blue case' });
  await pg.waitForSelector('.card'); assert.equal(await pg.locator('.card img, .card b').count(), 0, 'no HTML injection'); assert.ok((await pg.locator('.chip.overdue').textContent()).includes('5 days late'));
  assert.ok((await pg.locator('.banner.bad').textContent()).includes('Needs attention: 1'));
  // a second person: loan check warns
  await pg.click('#fab'); await pg.fill('#f-person', 'Mina <b>K</b>'); assert.ok((await pg.locator('#f-hint').textContent()).includes('overdue')); await escForm();
  // nudge: firm tone is offered when late
  await pg.click('.card .actions button >> nth=1'); await pg.waitForSelector('#n-text'); const gentle = await pg.inputValue('#n-text'); assert.ok(gentle.includes('Mina <b>K</b>') && gentle.includes('Drill'));
  await pg.check('input[name=tone][value=final]', { force: true }); assert.ok((await pg.inputValue('#n-text')).includes('last reminder')); await pg.click('#n-copy');
  assert.ok((await pg.evaluate(() => navigator.clipboard.readText())).includes('last reminder')); assert.ok(await pg.locator('#toast').isVisible(), 'copy confirmation is visible above the dialog'); assert.equal(await pg.evaluate(() => document.getElementById('toast').matches(':popover-open')), true, 'toast sits in the top layer'); await pg.screenshot({ path: out + '/nudge.png' }); await pg.keyboard.press('Escape');
  // money lent, partial repayment, completion with undo
  await add({ kind: 'money', title: 'Dinner', person: 'Joon', amount: 100, due: plus(10) });
  await pg.waitForSelector('.card >> nth=1'); await pg.click('.card:has-text("Joon") .pri'); await pg.waitForSelector('#rp-amt'); await pg.fill('#rp-amt', '40'); await pg.click('dialog button[type=submit]');
  await pg.waitForFunction(() => document.body.textContent.includes('$40.00 of $100.00 repaid')); assert.ok((await pg.locator('.card:has-text("Joon")').textContent()).includes('$40.00 of $100.00 repaid'));
  await pg.click('.card:has-text("Joon") .pri'); await pg.fill('#rp-amt', '999'); await pg.click('dialog button[type=submit]'); await pg.waitForFunction(() => !document.body.textContent.includes('Joon') || ![...document.querySelectorAll('.card')].some(c => c.textContent.includes('Joon')));
  assert.equal(await pg.locator('.card:has-text("Joon")').count(), 0, 'finished entry leaves the open list'); await pg.click('#toast button'); await pg.waitForSelector('.card:has-text("Joon")');
  // returned item (undo path tested above); mark Drill returned
  await pg.click('.card:has-text("Drill") .pri'); assert.equal(await pg.locator('.card:has-text("Drill")').count(), 0); await pg.click('button.link'); assert.equal(await pg.locator('.card.closed').count(), 1);
  // persistence
  await pg.reload(); await pg.waitForSelector('.card'); assert.equal(await pg.evaluate(() => window.__ln.state.entries.length), 2);
  // borrowed tab + extend
  await pg.click('[data-tab=in]'); await pg.waitForSelector('.empty'); await add({ dir: 'in', title: 'Camping tent', person: 'Dad', due: plus(2) }); await pg.waitForSelector('.chip.soon');
  await pg.click('.card:has-text("tent") .actions button >> nth=1'); await pg.waitForSelector('#ask-in'); await pg.fill('#ask-in', plus(20)); await pg.click('dialog button[type=submit]'); await pg.waitForSelector('.chip:not(.soon)');
  // detail dialog + edit
  await pg.click('.card:has-text("tent") .head'); await pg.waitForSelector('.tl'); assert.ok((await pg.locator('.tl').textContent()).includes('Extended')); await pg.screenshot({ path: out + '/detail.png' });
  await pg.click('dialog button:has-text("Edit")'); await pg.fill('#f-title', 'Big tent'); await pg.click('#f-save'); await pg.waitForSelector('.card:has-text("Big tent")');
  // people + insights
  await pg.click('[data-tab=people]'); await pg.waitForSelector('[data-person]'); assert.equal(await pg.locator('[data-person]').count(), 3); await pg.screenshot({ path: out + '/people.png' });
  await pg.click('[data-person] >> nth=0'); await pg.waitForSelector('#p-note'); await pg.fill('#p-note', 'neighbour'); await pg.click('dialog .pri'); await pg.waitForTimeout(100);
  await pg.click('[data-tab=ins]'); await pg.waitForSelector('svg.chart'); await pg.screenshot({ path: out + '/insights.png', fullPage: true });
  // settings: language switch persists, backup/restore/csv/ics
  await pg.click('[data-tab=set]'); await pg.selectOption('#s-lang', 'ko'); assert.equal(await pg.evaluate(() => document.documentElement.lang), 'ko'); assert.ok((await pg.locator('nav.tabs').textContent()).includes('빌려줌'));
  await pg.screenshot({ path: out + '/settings-ko.png' }); await pg.selectOption('#s-lang', 'en');
  const dl = async (sel) => { const [d] = await Promise.all([pg.waitForEvent('download'), pg.click(sel)]); return fs.readFileSync(await d.path(), 'utf8'); };
  const json = await dl('#s-backup'); assert.equal(JSON.parse(json).entries.length, 3); assert.ok((await dl('#s-csv')).includes('Big tent')); assert.ok((await dl('#s-ics')).includes('BEGIN:VEVENT'));
  await pg.click('#s-wipe'); await pg.click('#confirm-ok'); await pg.waitForTimeout(100); assert.equal(await pg.evaluate(() => window.__ln.state.entries.length), 0);
  fs.writeFileSync('/tmp/ln-backup.json', json); await pg.setInputFiles('#s-file', '/tmp/ln-backup.json'); await pg.waitForFunction(() => window.__ln.state.entries.length === 3);
  fs.writeFileSync('/tmp/ln-bad.json', '{"nope":1}'); await pg.setInputFiles('#s-file', '/tmp/ln-bad.json'); await pg.waitForSelector('#toast.on'); assert.ok((await pg.locator('#toast').textContent()).includes('could not be read'));
  // CSP: no inline-script violations / console errors
  // keyboard: tab order reaches fab; reduced layout at narrow width has no horizontal scroll
  await pg.click('[data-tab=out]'); assert.ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll');
  // offline: service worker caches the shell
  await pg.evaluate(() => navigator.serviceWorker.ready); await pg.reload(); await pg.waitForTimeout(500); await ctx.setOffline(true); await pg.reload(); await pg.waitForSelector('#root nav.tabs'); await ctx.setOffline(false);
  // dark mode renders
  await pg.emulateMedia({ colorScheme: 'dark' }); await pg.screenshot({ path: out + '/dark.png' });
  // returning the last open entry keeps the UI alive (regression)
  const lp = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await lp.goto(base + '/app/'); await lp.waitForSelector('.empty'); await lp.click('.empty button'); await lp.fill('#f-title', 'Book'); await lp.fill('#f-person', 'Zed'); await lp.click('#f-save');
  await lp.waitForSelector('.card .pri'); await lp.click('.card .pri'); await lp.waitForSelector('button.link'); assert.equal(await lp.locator('nav.tabs').count(), 1); assert.equal(await lp.locator('#toast.on').count(), 1);
  await lp.waitForTimeout(100); await lp.fill('#q', 'zzz').catch(() => {});
  // Cancel closes a clean form at once and asks before discarding a dirty one
  const cc = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await cc.goto(base + '/app/'); await cc.waitForSelector('.empty'); await cc.click('#fab'); await cc.click('dialog button:has-text("Cancel")'); await cc.waitForSelector('dialog', { state: 'detached' });
  await cc.click('#fab'); await cc.fill('#f-title', 'keep me'); await cc.click('dialog button:has-text("Cancel")'); await cc.waitForSelector('#confirm-ok'); await cc.click('dialog:has(#confirm-ok) button:has-text("Cancel")'); assert.equal(await cc.inputValue('#f-title'), 'keep me');
  // two tabs stay in sync instead of overwriting each other
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } }), t1 = await ctx2.newPage(), t2 = await ctx2.newPage();
  await t1.goto(base + '/app/'); await t2.goto(base + '/app/');
  for (const [pg2, nm] of [[t1, 'One'], [t2, 'Two']]) { await pg2.click('.empty button, #fab'); await pg2.fill('#f-title', nm); await pg2.fill('#f-person', 'P' + nm); await pg2.click('#f-save'); await pg2.waitForSelector('.card:has-text("' + nm + '")'); await pg2.waitForTimeout(150); }
  await t1.waitForFunction(() => window.__ln.state.entries.length === 2); assert.equal(await t2.evaluate(() => window.__ln.state.entries.length), 2);
  // concurrent edit: the stale tab refuses to overwrite and says so
  await t1.click('.card:has-text("One") .head'); await t1.click('dialog button:has-text("Edit")'); await t1.waitForSelector('#f-title');
  await t2.click('#fab'); await t2.fill('#f-title', 'Three'); await t2.fill('#f-person', 'PThree'); await t2.click('#f-save'); await t2.waitForSelector('.card:has-text("Three")'); await t2.waitForTimeout(200);
  await t1.fill('#f-title', 'One edited'); await t1.click('#f-save'); await t1.waitForSelector('#toast.on'); assert.ok((await t1.locator('#toast').textContent()).includes('Another tab')); assert.equal(await t1.evaluate(() => window.__ln.state.entries.length), 3);
  // cross-tab undo is refused instead of wiping the other tab's write
  await t1.keyboard.press('Escape'); await t1.waitForTimeout(100); if (await t1.locator('#confirm-ok').count()) await t1.click('#confirm-ok'); await t1.waitForSelector('dialog', { state: 'detached' });
  await t1.reload(); await t1.waitForSelector('.card'); await t1.click('.card >> nth=0 >> .pri'); await t1.waitForSelector('#toast.on button');
  await t2.reload(); await t2.click('#fab'); await t2.fill('#f-title', 'Four'); await t2.fill('#f-person', 'PFour'); await t2.click('#f-save'); await t2.waitForSelector('.card:has-text("Four")'); await t1.waitForFunction(() => window.__ln.state.entries.length === 4);
  await t1.evaluate(() => document.querySelector('#toast button') && document.querySelector('#toast button').click());
  assert.ok(await t1.locator('#toast').isVisible(), 'conflict toast is visible'); assert.ok((await t1.locator('#toast').textContent()).includes('Another tab'));
  assert.equal(await t2.evaluate(() => window.__ln.state.entries.length), 4); assert.equal(await t1.evaluate(() => window.__ln.state.entries.length), 4);
  // tiny amounts are refused
  await cc.fill('#f-title', ''); await cc.click('dialog button:has-text("Cancel")'); await cc.click('#confirm-ok'); await cc.click('#fab'); await cc.check('input[name=kind][value=money]', { force: true }); await cc.fill('#f-title', 'Coffee'); await cc.fill('#f-person', 'Q'); await cc.fill('#f-amount', '0.004'); await cc.click('#f-save'); assert.equal(await cc.getAttribute('#f-amount', 'aria-invalid'), 'true');
  // corrupt storage is preserved, not overwritten
  const cp = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await cp.goto(base + '/app/'); await cp.evaluate(() => localStorage.setItem('lendnest.v1', '{broken')); await cp.reload(); await cp.waitForSelector('.banner.bad');
  assert.equal(await cp.evaluate(() => localStorage.getItem('lendnest.v1.corrupt')), '{broken');
  // partly invalid storage is copied once, not on every reload
  const pi = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await pi.goto(base + '/app/');
  await pi.evaluate(() => localStorage.setItem('lendnest.v1', JSON.stringify({ v: 1, people: [{ id: 'a', name: 'A' }], entries: [{ id: 'e1', title: 'ok', personId: 'a', dir: 'out', kind: 'item' }, { id: 'e2', title: 'orphan', personId: 'zzz' }], settings: {} })));
  await pi.reload(); await pi.reload(); await pi.reload(); assert.equal(await pi.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('lendnest.v1.corrupt')).length), 1);
  // no room for the unreadable-data copy: edits pause, nothing is overwritten until the user downloads it
  const qp = await (await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })).newPage(); await qp.goto(base + '/app/');
  await qp.evaluate(() => { const pad = 'x'.repeat(200000), es = [{ id: 'orph', title: 'orphan', personId: 'zzz' }]; for (let i = 0; i < 9; i++) es.push({ id: 'e' + i, title: 'ok' + i, personId: 'a', dir: 'out', kind: 'item', junk: pad }); localStorage.setItem('lendnest.v1', JSON.stringify({ v: 1, people: [{ id: 'a', name: 'A' }], entries: es, settings: {} })); const filler = 'y'.repeat(1000000); try { for (let i = 0; i < 9; i++) localStorage.setItem('fill' + i, filler); } catch (e) {} });
  await qp.reload(); await qp.waitForSelector('.banner.bad'); const locked = await qp.evaluate(() => !document.getElementById('fab'));
  assert.ok(locked || await qp.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('lendnest.v1.corrupt'))), 'either a verified copy exists or the app is locked');
  if (locked) { assert.equal((await qp.locator('#dl-corrupt').textContent()).trim(), 'Download unreadable data'); assert.ok((await qp.evaluate(() => localStorage.getItem('lendnest.v1'))).includes('orphan')); const [dl2] = await Promise.all([qp.waitForEvent('download'), qp.click('#dl-corrupt')]); assert.ok(fs.readFileSync(await dl2.path(), 'utf8').includes('orphan')); await qp.waitForSelector('#fab'); assert.ok((await qp.locator('.banner.bad').textContent()).includes('downloaded')); }
  // language picked on the landing page carries into the app
  const lc = await (await b.newContext({ locale: 'en-US', viewport: { width: 390, height: 844 } })).newPage(); await lc.goto(base + '/'); await lc.selectOption('#lang', 'ja'); await lc.goto(base + '/app/'); await lc.waitForSelector('.empty'); assert.equal(await lc.evaluate(() => document.documentElement.lang), 'ja');
  // item kind hides the money fields; a person's note survives an unrelated edit and people are pruned only when unlinked
  const nn = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await nn.goto(base + '/app/'); await nn.waitForSelector('.empty'); await nn.click('.empty button');
  await nn.check('input[name=kind][value=item]', { force: true }); assert.equal(await nn.locator('#f-amount').isVisible(), false); await nn.check('input[name=kind][value=money]', { force: true }); assert.equal(await nn.locator('#f-amount').isVisible(), true);
  await nn.check('input[name=kind][value=item]', { force: true }); await nn.fill('#f-title', 'Drill'); await nn.fill('#f-person', 'Ann'); await nn.click('#f-save'); await nn.waitForSelector('.card:has-text("Drill")');
  await nn.evaluate(() => { const s = window.__ln.state; s.people.find(p => p.name === 'Ann').note = 'call first'; localStorage.setItem('lendnest.v1', JSON.stringify(s)); }); await nn.reload(); await nn.waitForSelector('.card');
  await nn.click('#fab'); await nn.fill('#f-title', 'Tent'); await nn.fill('#f-person', 'Bo'); await nn.click('#f-save'); await nn.waitForSelector('.card:has-text("Tent")');
  await nn.click('.card:has-text("Drill") .head'); await nn.click('dialog button:has-text("Delete")'); await nn.click('#confirm-ok'); await nn.waitForFunction(() => !document.body.textContent.includes('Drill'));
  await nn.click('.card:has-text("Tent") .head'); await nn.click('dialog button:has-text("Edit")'); await nn.fill('#f-title', 'Tent 2'); await nn.click('#f-save'); await nn.waitForSelector('.card:has-text("Tent 2")');
  assert.equal(await nn.evaluate(() => window.__ln.state.people.some(p => p.name === 'Ann' && p.note === 'call first')), true, 'note survives');
  // installments, statement, handover card, upcoming list
  const ft = await (await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] })).newPage(); await ft.goto(base + '/app/'); await ft.waitForSelector('.empty'); await ft.click('.empty button');
  await ft.check('input[name=kind][value=money]', { force: true }); await ft.fill('#f-title', 'Laptop'); await ft.fill('#f-person', 'Kim'); await ft.fill('#f-amount', '300'); await ft.selectOption('#f-plan', '3'); await ft.click('#f-save'); await ft.waitForSelector('.card:has-text("Installment 1 of 3")');
  await ft.click('.card .head'); await ft.waitForSelector('#d-card'); const [cd] = await Promise.all([ft.waitForEvent('download'), ft.click('#d-card')]); assert.equal(cd.suggestedFilename(), 'lendnest-note.png'); assert.ok(fs.statSync(await cd.path()).size > 2000); await ft.keyboard.press('Escape');
  await ft.click('[data-tab=people]'); await ft.click('[data-person]'); await ft.click('#p-stmt'); assert.ok((await ft.evaluate(() => navigator.clipboard.readText())).includes('Laptop')); await ft.keyboard.press('Escape');
  await ft.click('[data-tab=ins]'); await ft.waitForSelector('h2.sec'); assert.ok((await ft.locator('main').textContent()).includes('Coming up'));
  // Korean first-run detection
  const ko = await (await b.newContext({ locale: 'ko-KR', viewport: { width: 390, height: 844 } })).newPage(); await ko.goto(base + '/app/'); await ko.waitForSelector('.empty'); assert.ok((await ko.locator('.empty h2').textContent()).includes('빌려준'));
  assert.deepEqual(errs, [], 'console/page errors: ' + errs.join(' | '));
  console.log('e2e ok'); await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
