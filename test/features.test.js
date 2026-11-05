const test = require('node:test'), assert = require('node:assert/strict');
const C = require('../app/core.js');

test('tags: trimmed, de-duplicated case-insensitively, at most 5, 24 chars', () => {
  assert.deepEqual(C.parseTags(' tools, Tools ,books，garden'), ['tools', 'books', 'garden']);
  assert.equal(C.parseTags(['a', 'b', 'c', 'd', 'e', 'f', 'g']).length, 5);
  assert.equal(C.parseTags('x'.repeat(60))[0].length, 24);
  assert.deepEqual(C.parseTags(undefined), []);
});
test('tags: allTags counts most-used first and hasTag ignores case', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina');
  s.entries.push(C.makeEntry({ title: 'a', personId: p.id, tags: 'Tools' }), C.makeEntry({ title: 'b', personId: p.id, tags: 'tools, books' }));
  assert.deepEqual(C.allTags(s).map(x => [x.tag, x.count]), [['Tools', 2], ['books', 1]]);
  assert.ok(C.hasTag(s.entries[0], 'TOOLS')); assert.ok(!C.hasTag(s.entries[1], 'garden'));
});
test('search matches tags', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina'); const e = C.makeEntry({ title: 'Saw', personId: p.id, tags: 'workshop' });
  assert.ok(C.match(e, p, 'workshop')); assert.ok(!C.match(e, p, 'kitchen'));
});
test('reminder log: records valid tones and dates, keeps the newest 50', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina'); const e = C.makeEntry({ title: 'a', personId: p.id, dir: 'out' });
  assert.equal(C.recordNudge(e, 'shout', '2026-10-01'), false); assert.equal(C.recordNudge(e, 'firm', 'bad'), false);
  C.recordNudge(e, 'gentle', '2026-10-01'); C.recordNudge(e, 'final', '2026-10-05');
  assert.deepEqual(C.lastNudge(e), { date: '2026-10-05', tone: 'final' });
  for (let i = 0; i < 60; i++) C.recordNudge(e, 'firm', '2026-10-06');
  assert.equal(e.nudges.length, 50);
});
test('sanitize keeps tags and reminder log through a save and reload', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina'); const e = C.makeEntry({ title: 'a', personId: p.id, tags: 'x, y', dir: 'out' });
  C.recordNudge(e, 'gentle', '2026-10-01'); s.entries.push(e);
  const back = C.sanitize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.entries[0].tags, ['x', 'y']); assert.deepEqual(back.entries[0].nudges, [{ date: '2026-10-01', tone: 'gentle' }]);
});
test('sanitize drops malformed reminder entries', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina');
  const raw = { people: [p], entries: [Object.assign(C.makeEntry({ title: 'a', personId: p.id }), { nudges: [{ date: 'nope', tone: 'gentle' }, { date: '2026-10-01', tone: 'x' }, null, { date: '2026-10-02', tone: 'firm' }] })], settings: {} };
  assert.deepEqual(C.sanitize(raw).entries[0].nudges, [{ date: '2026-10-02', tone: 'firm' }]);
});

test('reminders: due on or before today, oldest first, closed entries never due', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina');
  const a = C.makeEntry({ title: 'a', personId: p.id, date: '2026-10-01' }), b = C.makeEntry({ title: 'b', personId: p.id, date: '2026-10-01' }), c = C.makeEntry({ title: 'c', personId: p.id, date: '2026-10-01' });
  C.setRemindOn(a, '2026-10-05'); C.setRemindOn(b, '2026-10-03'); C.setRemindOn(c, '2026-10-20');
  s.entries.push(a, b, c);
  assert.deepEqual(C.remindersDue(s, '2026-10-05').map(e => e.title), ['b', 'a']);
  C.markReturned(a, '2026-10-04'); assert.deepEqual(C.remindersDue(s, '2026-10-05').map(e => e.title), ['b']);
  assert.equal(C.setRemindOn(b, 'nope'), ''); assert.equal(C.remindersDue(s, '2026-10-05').length, 0);
});
test('snooze moves the reminder to a day from now', () => {
  const e = C.makeEntry({ title: 'x', personId: 'p', date: '2026-10-01' });
  assert.equal(C.snoozeReminder(e, 3, '2026-10-05'), '2026-10-08');
});
test('sanitize keeps a valid reminder date and drops an invalid one', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina');
  const ok = C.makeEntry({ title: 'a', personId: p.id, remindOn: '2026-10-09' }), bad = C.makeEntry({ title: 'b', personId: p.id, remindOn: '2026-13-40' });
  s.entries.push(ok, bad); const back = C.sanitize(JSON.parse(JSON.stringify(s)));
  assert.equal(back.entries[0].remindOn, '2026-10-09'); assert.equal(back.entries[1].remindOn, '');
});
test('tag summary: open and closed counts, outstanding money per currency', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina');
  const m = C.makeEntry({ kind: 'money', amount: 40, currency: 'USD', title: 'loan', personId: p.id, date: '2026-10-01', tags: 'cash' });
  const i = C.makeEntry({ title: 'drill', personId: p.id, date: '2026-10-01', tags: 'Cash, tools' });
  s.entries.push(m, i); C.repay(m, 15, '2026-10-02');
  const r = C.tagSummary(s); const cash = r.find(x => x.tag.toLowerCase() === 'cash');
  assert.equal(cash.open, 2); assert.equal(cash.closed, 0); assert.deepEqual(cash.money, { USD: 25 });
  assert.equal(r.find(x => x.tag === 'tools').open, 1);
});
test('filters: status, type and person narrow the list; closed and active are complements', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina'), q = C.addPerson(s, 'Ken');
  const a = C.makeEntry({ title: 'a', personId: p.id, date: '2026-10-01', due: '2026-10-03' });
  const b = C.makeEntry({ kind: 'money', amount: 5, title: 'b', personId: q.id, date: '2026-10-01', due: '2026-10-20' });
  const c = C.makeEntry({ title: 'c', personId: p.id, date: '2026-10-01', due: '2026-10-03' }); C.markReturned(c, '2026-10-02');
  const all = [a, b, c], now = '2026-10-05';
  assert.deepEqual(C.filterEntries(all, {}, now), all);
  assert.deepEqual(C.filterEntries(all, { status: 'overdue' }, now), [a]);
  assert.deepEqual(C.filterEntries(all, { status: 'soon' }, '2026-10-01'), [a]);
  assert.deepEqual(C.filterEntries(all, { status: 'closed' }, now), [c]);
  assert.deepEqual(C.filterEntries(all, { status: 'active' }, now), [a, b]);
  assert.deepEqual(C.filterEntries(all, { kind: 'money' }, now), [b]);
  assert.deepEqual(C.filterEntries(all, { personId: p.id }, now), [a, c]);
  assert.deepEqual(C.filterEntries(all, { personId: p.id, status: 'active', kind: 'item' }, now), [a]);
});
test('item return note: kept on return, sanitised, cleared on reopen, exported to CSV', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina'); const e = C.makeEntry({ title: 'Drill', personId: p.id, date: '2026-10-01' }); s.entries.push(e);
  assert.ok(C.markReturned(e, '2026-10-03', ' Chipped case ')); assert.equal(e.returnNote, 'Chipped case');
  assert.equal(C.sanitize(JSON.parse(JSON.stringify(s))).entries[0].returnNote, 'Chipped case');
  assert.ok(C.toCSV(s).split('\r\n')[0].endsWith(',condition')); assert.ok(C.toCSV(s).includes('Chipped case'));
  assert.ok(C.reopen(e)); assert.equal(e.returnNote, '');
  C.markReturned(e, '2026-10-04'); assert.equal(e.returnNote, '');
  const m = C.makeEntry({ kind: 'money', amount: 5, title: 'm', personId: p.id, date: '2026-10-01' }); C.markReturned(m, '2026-10-02', 'ignored'); assert.equal(m.returnNote, '');
  const orphan = JSON.parse(JSON.stringify(s)); orphan.entries[0].returnedAt = null; orphan.entries[0].returnNote = 'stale'; assert.equal(C.sanitize(orphan).entries[0].returnNote, '');
});
test('who has what: open entries grouped by person, closed and empty people left out', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina'), q = C.addPerson(s, 'Ken'); C.addPerson(s, 'Zoe');
  const a = C.makeEntry({ title: 'a', personId: p.id, date: '2026-10-01', due: '2026-10-03' });
  const b = C.makeEntry({ title: 'b', personId: p.id, date: '2026-10-01' });
  const c = C.makeEntry({ title: 'c', personId: q.id, date: '2026-10-01' }); C.markReturned(c, '2026-10-02');
  s.entries.push(a, b, c);
  const g = C.groupOpenByPerson(s, '2026-10-05');
  assert.deepEqual(g.map(x => x.person.name), ['Mina']); assert.deepEqual(g[0].entries, [a, b]);
});
test('balances: open money per person, each way, per currency; closed and items ignored', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina');
  const m1 = C.makeEntry({ kind: 'money', amount: 100, currency: 'USD', title: '', personId: p.id, date: '2026-10-01' });
  const m2 = C.makeEntry({ kind: 'money', amount: 40, currency: 'USD', title: '', personId: p.id, dir: 'in', date: '2026-10-01' });
  const m3 = C.makeEntry({ kind: 'money', amount: 9, currency: 'EUR', title: '', personId: p.id, date: '2026-10-01' }); C.markReturned(m3, '2026-10-02');
  const it = C.makeEntry({ title: 'tent', personId: p.id, date: '2026-10-01' });
  s.entries.push(m1, m2, m3, it); C.repay(m1, 30, '2026-10-03');
  const [b] = C.balances(s); assert.equal(b.personId, p.id); assert.deepEqual(b.owedToMe, { USD: 70 }); assert.deepEqual(b.iOwe, { USD: 40 });
});
test('due digest: open items due within the window, overdue included, most urgent first; open CSV has only open rows', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina');
  const far = C.makeEntry({ title: 'far', personId: p.id, date: '2026-10-01', due: '2026-12-01' });
  const soon = C.makeEntry({ title: 'soon', personId: p.id, date: '2026-10-01', due: '2026-10-08' });
  const late = C.makeEntry({ title: 'late', personId: p.id, date: '2026-09-01', due: '2026-10-02' });
  const done = C.makeEntry({ title: 'done', personId: p.id, date: '2026-10-01', due: '2026-10-06' }); C.markReturned(done, '2026-10-02');
  s.entries.push(far, soon, late, done);
  assert.deepEqual(C.dueDigest(s, 7, '2026-10-05').map(e => e.title), ['late', 'soon']);
  const csv = C.toOpenCSV(s, '2026-10-05'); assert.ok(csv.startsWith('﻿direction,')); assert.ok(csv.includes('soon')); assert.ok(!csv.includes('done'));
  assert.equal(csv.trim().split('\r\n').length, 4);
  assert.equal(C.toOpenCSV(s, '2026-10-05', 'nobody').trim().split('\r\n').length, 1);
});
test('sort modes: due date (urgency), name, newest first', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina');
  const mk = (t, due, created) => C.makeEntry({ title: t, personId: p.id, date: '2026-10-01', due, created });
  const a = mk('banana', '2026-10-20', 1), b = mk('apple', '', 3), c = mk('cherry', '2026-10-02', 2);
  const list = [a, b, c];
  assert.deepEqual(C.sortBy(list, 'name', '2026-10-05').map(e => e.title), ['apple', 'banana', 'cherry']);
  assert.deepEqual(C.sortBy(list, 'recent', '2026-10-05').map(e => e.title), ['apple', 'cherry', 'banana']);
  assert.deepEqual(C.sortBy(list, 'due', '2026-10-05').map(e => e.title), ['cherry', 'banana', 'apple']);
  assert.equal(list[0], a, 'input is not reordered');
});
test('import: a second person with the same name joins the first instead of splitting', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina'); const e = C.makeEntry({ title: 'x', personId: p.id }); s.entries.push(e);
  const raw = JSON.parse(JSON.stringify(s)); raw.people.push({ id: 'dup1', name: ' mina ', note: '' }); raw.entries.push(Object.assign(C.makeEntry({ title: 'y', personId: p.id }), { id: 'e2', personId: 'dup1' }));
  const imp = C.sanitize(raw); assert.equal(imp.people.length, 1); assert.equal(imp.entries.length, 2); assert.equal(imp.entries[1].personId, imp.people[0].id);
});
test('CSV starts with a BOM written as an escape in the source', () => {
  const s = C.newState(); assert.equal(C.toOpenCSV(s).charCodeAt(0), 0xfeff); assert.equal(C.toCSV(s).charCodeAt(0), 0xfeff);
});
test('kept days never go negative: personStats clamps, import moves an early return date up to the lent date', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina');
  const e = C.makeEntry({ title: 'x', personId: p.id, date: '2026-10-05' }); e.returnedAt = '2026-10-01'; s.entries.push(e);
  assert.equal(C.personStats(s, p.id, '2026-11-01').avgKept, 0);
  const imp = C.sanitize(JSON.parse(JSON.stringify(s))); assert.equal(imp.entries[0].returnedAt, '2026-10-05');
  assert.equal(C.personStats(imp, p.id, '2026-11-01').avgKept, 0);
});
