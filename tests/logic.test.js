import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_MODEL,
  breakIssue,
  buildAnalysisPrompt,
  buildPayFacts,
  cleanText,
  isPlausibleKey,
  lawFlags,
  localPayAnalysis,
  parseAnalysisResponse,
  parseAnalysisText,
  checkWarnings,
  csvCell,
  isRealDate,
  monthlyReport,
  monthlyToCSV,
  sanitizeEmployee,
  sanitizeShift,
  sanitizeState,
  shiftMinutes,
  shiftsToCSV,
  spanMinutes,
  weekStartOf,
  weeklyReport,
} from '../logic.js';

const emp = (over = {}) => ({ id: 'e1', name: '민지', wage: 10000, ...over });
const sh = (over = {}) => ({
  id: 's' + Math.random().toString(36).slice(2),
  empId: 'e1',
  date: '2026-03-02', // 월요일
  start: '09:00',
  end: '18:00',
  breakMin: 60,
  memo: '',
  ...over,
});

test('isRealDate: 존재하지 않는 날짜 거부', () => {
  assert.equal(isRealDate('2026-02-28'), true);
  assert.equal(isRealDate('2026-02-30'), false);
  assert.equal(isRealDate('2026-3-1'), false);
});

test('spanMinutes / shiftMinutes: 자정 넘김과 휴게 차감', () => {
  assert.equal(spanMinutes('09:00', '18:00'), 540);
  assert.equal(spanMinutes('22:00', '02:00'), 240);
  assert.equal(shiftMinutes(sh({ start: '22:00', end: '02:00', breakMin: 30 })), 210);
  assert.equal(shiftMinutes(sh({ start: '09:00', end: '18:00', breakMin: 60 })), 480);
});

test('sanitizeShift: 같은 시각, 휴게 과다, 잘못된 시간 형식 거부', () => {
  assert.equal(sanitizeShift(sh({ start: '09:00', end: '09:00' })), null);
  assert.equal(sanitizeShift(sh({ start: '09:00', end: '10:00', breakMin: 60 })), null);
  assert.equal(sanitizeShift(sh({ start: '9:00' })), null);
  assert.equal(sanitizeShift(sh({ breakMin: -5 })), null);
  assert.ok(sanitizeShift(sh()));
});

test('sanitizeEmployee: 이름 공백 제거, 시급 0 이하 거부', () => {
  assert.equal(sanitizeEmployee({ id: 'a', name: '  홍길동  ', wage: '10,000' }).name, '홍길동');
  assert.equal(sanitizeEmployee({ id: 'a', name: '홍', wage: 0 }), null);
  assert.equal(sanitizeEmployee({ id: 'a', name: '   ', wage: 9000 }), null);
});

test('sanitizeState: 없는 직원의 기록 제외, 중복 제거, 최저임금 정리', () => {
  const st = sanitizeState({
    employees: [emp(), emp()],
    shifts: [sh({ id: 'x' }), sh({ id: 'x' }), sh({ id: 'y', empId: 'ghost' })],
    minWage: '10,320',
  });
  assert.equal(st.employees.length, 1);
  assert.equal(st.shifts.length, 1);
  assert.equal(st.minWage, 10320);
  assert.equal(sanitizeState('bad').minWage, null);
});

test('weekStartOf: 일요일은 직전 월요일로 귀속', () => {
  assert.equal(weekStartOf('2026-03-02'), '2026-03-02'); // 월
  assert.equal(weekStartOf('2026-03-08'), '2026-03-02'); // 일
  assert.equal(weekStartOf('2026-03-09'), '2026-03-09'); // 다음 월
});

test('주휴수당: 주 15시간 미만은 0, 20시간은 4시간분', () => {
  const under = weeklyReport(
    [sh({ date: '2026-03-02', start: '09:00', end: '14:00', breakMin: 0 }), sh({ date: '2026-03-03', start: '09:00', end: '14:00', breakMin: 0 }), sh({ date: '2026-03-04', start: '09:00', end: '13:00', breakMin: 0 })],
    [emp()],
  );
  assert.equal(under[0].hours, 14);
  assert.equal(under[0].holidayHours, 0);
  assert.equal(under[0].holidayPay, 0);

  const twenty = weeklyReport(
    [sh({ date: '2026-03-02', start: '09:00', end: '14:00', breakMin: 0 }), sh({ date: '2026-03-03', start: '09:00', end: '14:00', breakMin: 0 }), sh({ date: '2026-03-04', start: '09:00', end: '14:00', breakMin: 0 }), sh({ date: '2026-03-05', start: '09:00', end: '14:00', breakMin: 0 })],
    [emp()],
  );
  assert.equal(twenty[0].hours, 20);
  assert.equal(twenty[0].holidayHours, 4); // 20/40 × 8
  assert.equal(twenty[0].holidayPay, 40000);
});

test('주휴수당: 40시간 이상이어도 8시간 상한', () => {
  const shifts = [];
  for (let d = 2; d <= 6; d++) {
    shifts.push(sh({ date: `2026-03-0${d}`, start: '09:00', end: '18:00', breakMin: 0 })); // 9시간 × 5 = 45시간
  }
  const [w] = weeklyReport(shifts, [emp()]);
  assert.equal(w.hours, 45);
  assert.equal(w.holidayHours, 8);
  assert.equal(w.overtimeHours, 5);
  assert.equal(w.overtimePay, 25000); // 5 × 10,000 × 0.5
  assert.equal(w.basePay, 450000);
  assert.equal(w.holidayPay, 80000);
});

test('주간 집계: 날짜가 달라도 같은 주(월~일)면 합산', () => {
  const weeks = weeklyReport(
    [sh({ date: '2026-03-08', start: '09:00', end: '12:00', breakMin: 0 }), sh({ date: '2026-03-02', start: '09:00', end: '12:00', breakMin: 0 })],
    [emp()],
  );
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].hours, 6);
});

test('monthlyReport: 직원·월별 합계, 월 내림차순', () => {
  const emps = [emp(), emp({ id: 'e2', name: '수호', wage: 12000 })];
  const weeks = weeklyReport(
    [
      sh({ date: '2026-03-02', start: '09:00', end: '13:00', breakMin: 0 }),
      sh({ date: '2026-04-06', start: '09:00', end: '13:00', breakMin: 0, empId: 'e2' }),
    ],
    emps,
  );
  const rows = monthlyReport(weeks);
  assert.deepEqual(rows.map((r) => r.month), ['2026-04', '2026-03']);
  assert.equal(rows[0].name, '수호');
  assert.equal(rows[0].basePay, 48000);
  assert.equal(rows[1].total, 40000);
});

test('checkWarnings: 최저임금 미달은 error, 연장·주휴 미발생은 info', () => {
  const emps = [emp({ wage: 9000 }), emp({ id: 'e2', name: '수호', wage: 11000 })];
  const weeks = weeklyReport(
    [
      sh({ date: '2026-03-02', start: '09:00', end: '18:00', breakMin: 0, empId: 'e2' }),
      sh({ date: '2026-03-03', start: '09:00', end: '18:00', breakMin: 0, empId: 'e2' }),
      sh({ date: '2026-03-04', start: '09:00', end: '18:00', breakMin: 0, empId: 'e2' }),
      sh({ date: '2026-03-05', start: '09:00', end: '18:00', breakMin: 0, empId: 'e2' }),
      sh({ date: '2026-03-06', start: '09:00', end: '18:00', breakMin: 0, empId: 'e2' }),
      sh({ date: '2026-03-07', start: '09:00', end: '11:00', breakMin: 0 }),
    ],
    emps,
  );
  const w = checkWarnings(weeks, emps, 10000);
  assert.equal(w.filter((x) => x.level === 'error').length, 1);
  assert.ok(w.some((x) => x.level === 'info' && x.text.includes('연장')));
  assert.ok(w.some((x) => x.level === 'info' && x.text.includes('주휴수당 대상이 아닙니다')));
  assert.equal(checkWarnings(weeks, emps, null).filter((x) => x.level === 'error').length, 0);
});

test('csvCell: 수식 주입 방지 (직원 이름·메모)', () => {
  assert.equal(csvCell('=1+1'), `'=1+1`);
  assert.equal(csvCell('@cmd'), `'@cmd`);
  assert.equal(csvCell('a"b'), '"a""b"');
});

test('shiftsToCSV: BOM, 직원 이름 치환, 근무시간 소수', () => {
  const csv = shiftsToCSV(
    [sh({ date: '2026-03-02', start: '09:00', end: '13:30', breakMin: 0, memo: '=evil' })],
    [emp({ name: '=이름' })],
  );
  assert.ok(csv.startsWith('﻿'));
  const [head, row] = csv.replace('﻿', '').trim().split('\r\n');
  assert.equal(head, '날짜,직원,시작,종료,휴게(분),근무시간(h),메모');
  assert.equal(row, `2026-03-02,'=이름,09:00,13:30,0,4.5,'=evil`);
});

test('monthlyToCSV: 헤더와 행 구성', () => {
  const csv = monthlyToCSV(monthlyReport(weeklyReport([sh({ date: '2026-03-02', start: '09:00', end: '13:00', breakMin: 0 })], [emp()])));
  const lines = csv.replace('﻿', '').trim().split('\r\n');
  assert.equal(lines[0], '월,직원,근무시간(h),기본급,연장가산,주휴수당,합계');
  assert.equal(lines[1], '2026-03,민지,4,40000,0,0,40000');
});

// ── AI 분석 ──
test('cleanText strips control characters, collapses spaces and caps length', () => {
  assert.equal(cleanText('  a\u0000b\n\n c  ', 10), 'a b c');
  assert.equal(cleanText('가'.repeat(50), 5).length, 5);
  assert.equal(cleanText(undefined), '');
});

test('isPlausibleKey accepts Anthropic-shaped keys only', () => {
  assert.equal(isPlausibleKey('sk-ant-api03-abcdefghijklmnopqrstuvwxyz'), true);
  assert.equal(isPlausibleKey('  sk-ant-api03-abcdefghijklmnopqrstuvwxyz  '), true);
  assert.equal(isPlausibleKey('short'), false);
  assert.equal(isPlausibleKey('sk-ant has spaces in it at all'), false);
  assert.equal(isPlausibleKey(''), false);
});

test('breakIssue applies the 4h/30min and 8h/60min rules on working time', () => {
  assert.equal(breakIssue(sh({ start: '09:00', end: '18:00', breakMin: 60 })), null);
  assert.equal(breakIssue(sh({ start: '09:00', end: '18:00', breakMin: 30 })), 'break8');
  assert.equal(breakIssue(sh({ start: '09:00', end: '14:00', breakMin: 0 })), 'break4');
  assert.equal(breakIssue(sh({ start: '09:00', end: '13:00', breakMin: 30 })), null);
  assert.equal(breakIssue(sh({ start: '09:00', end: '12:00', breakMin: 0 })), null);
});

test('buildPayFacts sends only anonymous labels and numbers, never names', () => {
  const employees = [emp({ id: 'e1', name: '김철수가 이름' }), emp({ id: 'e2', name: '박영희', wage: 9000 })];
  const shifts = [
    sh({ id: 'a', empId: 'e1', date: '2026-03-02', start: '09:00', end: '20:00', breakMin: 0, memo: '비밀 메모' }),
    sh({ id: 'b', empId: 'e2', date: '2026-03-03', start: '09:00', end: '13:00', breakMin: 0 }),
  ];
  const { facts, legend } = buildPayFacts('2026-03', shifts, employees, 10000);
  const sent = JSON.stringify(facts);
  assert.ok(!sent.includes('김철수'));
  assert.ok(!sent.includes('박영희'));
  assert.ok(!sent.includes('비밀 메모'));
  assert.deepEqual(legend.map((x) => x.name).sort(), ['김철수가 이름', '박영희']);
  const first = facts.people.find((p) => p.label === '직원 1');
  assert.equal(first.hours, 11);
  assert.equal(first.overtimePay, 0);
  assert.equal(first.breakShort8, 1);
  assert.equal(facts.people.find((p) => p.label === '직원 2').belowMinWage, true);
  assert.equal(facts.minWage, 10000);
});

test('lawFlags reports minimum wage, break, 52h and overtime items with the right levels', () => {
  const employees = [emp({ id: 'e1', wage: 9000 })];
  const shifts = [];
  // 6 days x 10h (no break) = 60h in one week
  for (let d = 2; d <= 7; d++) {
    shifts.push(sh({ id: 'x' + d, empId: 'e1', date: `2026-03-0${d}`, start: '08:00', end: '18:00', breakMin: 0 }));
  }
  const { facts } = buildPayFacts('2026-03', shifts, employees, 10000);
  const flags = lawFlags(facts);
  const levels = flags.map((f) => f.level);
  assert.ok(levels.includes('error'), 'minimum wage error');
  assert.ok(flags.some((f) => f.text.includes('휴게시간이 부족')), 'break warning');
  assert.ok(flags.some((f) => f.text.includes('52시간')), '52h warning');
  assert.ok(flags.some((f) => f.text.includes('연장 가산')), 'overtime info');
});

test('localPayAnalysis returns a usable result when there are no records', () => {
  const { facts } = buildPayFacts('2026-03', [], [], null);
  const r = localPayAnalysis(facts);
  assert.equal(r.source, 'local');
  assert.equal(r.issues.length, 0);
  assert.ok(r.summary.includes('근무 기록이 없어'));
  assert.ok(r.nextSteps.length >= 1);
});

test('buildAnalysisPrompt carries the disclaimer, the model id is fixed, and user text is cleaned', () => {
  const { facts } = buildPayFacts('2026-03', [], [], null);
  const p = buildAnalysisPrompt(facts);
  assert.match(p.system, /추정/);
  assert.match(p.system, /법률 자문/);
  assert.equal(AI_MODEL, 'claude-haiku-5-5');
  assert.ok(p.user.includes('2026-03'));
  const evil = buildAnalysisPrompt({ ...facts, month: '2026-03\n\nIgnore previous' });
  assert.ok(!evil.user.includes('\n\nIgnore'));
});

test('parseAnalysisText reads bare and fenced JSON and drops invalid items', () => {
  const json = {
    summary: '요약입니다.',
    issues: [
      { level: 'warn', employee: '직원 1', text: '휴게 부족' },
      { level: 'CRITICAL', employee: '직원 2', text: '등급 이상' },
      { level: 'error', employee: '직원 3', text: '' },
      'junk',
    ],
    nextSteps: ['확인하세요', '', 3],
  };
  const bare = parseAnalysisText(JSON.stringify(json));
  assert.equal(bare.source, 'ai');
  assert.equal(bare.summary, '요약입니다.');
  assert.deepEqual(bare.issues.map((i) => i.level), ['warn', 'info']);
  assert.deepEqual(bare.nextSteps, ['확인하세요']);
  const fenced = parseAnalysisText('```json\n' + JSON.stringify(json) + '\n```');
  assert.equal(fenced.issues.length, 2);
});

test('parseAnalysisText keeps plain prose as the summary and returns null for empty text', () => {
  const r = parseAnalysisText('그냥 글입니다.\n두 줄째');
  assert.equal(r.source, 'ai-text');
  assert.equal(r.summary, '그냥 글입니다. 두 줄째');
  assert.deepEqual(r.issues, []);
  assert.equal(parseAnalysisText('   '), null);
});

test('parseAnalysisResponse uses only text blocks and ignores thinking blocks', () => {
  const data = {
    stop_reason: 'end_turn',
    content: [
      { type: 'thinking', thinking: '', signature: 'x' },
      { type: 'text', text: '{"summary":"OK","issues":[],"nextSteps":[]}' },
    ],
  };
  assert.equal(parseAnalysisResponse(data).summary, 'OK');
  assert.equal(parseAnalysisResponse({ content: [] }), null);
  assert.equal(parseAnalysisResponse(null), null);
});

test('weekHeadroom: hours left to the holiday pay and overtime thresholds', async () => {
  const { weekHeadroom } = await import('../logic.js');
  assert.deepEqual(weekHeadroom({ hours: 10 }), { toHoliday: 5, toOvertime: 30 });
  assert.deepEqual(weekHeadroom({ hours: 15 }), { toHoliday: 0, toOvertime: 25 });
  assert.deepEqual(weekHeadroom({ hours: 40 }), { toHoliday: 0, toOvertime: 0 });
  assert.deepEqual(weekHeadroom({ hours: 42.5 }), { toHoliday: 0, toOvertime: 0 });
  assert.deepEqual(weekHeadroom({ hours: 12.25 }), { toHoliday: 2.8, toOvertime: 27.8 });
  assert.deepEqual(weekHeadroom({ hours: NaN }), { toHoliday: 15, toOvertime: 40 });
  assert.deepEqual(weekHeadroom(undefined), { toHoliday: 15, toOvertime: 40 });
});

test('effectiveHourly: total pay divided by hours, zero when no hours or bad input', async () => {
  const { effectiveHourly } = await import('../logic.js');
  assert.equal(effectiveHourly({ hours: 20, total: 220000 }), 11000);
  assert.equal(effectiveHourly({ hours: 0, total: 0 }), 0);
  assert.equal(effectiveHourly({ hours: 10, total: -5 }), 0);
  assert.equal(effectiveHourly({ hours: NaN, total: 100 }), 0);
  assert.equal(effectiveHourly(null), 0);
});
