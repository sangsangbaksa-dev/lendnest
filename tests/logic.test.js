import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
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
