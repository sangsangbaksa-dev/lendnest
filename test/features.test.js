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
