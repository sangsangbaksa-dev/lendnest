// 근무장부 — 순수 계산 로직 (DOM 접근 없음)
// 근로기준법 기준의 "추정" 계산입니다.
// 반영하지 않는 것: 개근 조건, 소정근로시간(계약 기준), 야간·휴일 가산, 수당 외 공제.

export const WEEKLY_HOLIDAY_MIN_HOURS = 15; // 주 15시간 이상 근무 시 주휴수당 발생
export const WEEKLY_STANDARD_HOURS = 40; // 법정 근로시간 (주)
export const HOLIDAY_HOURS_CAP = 8; // 주휴시간 상한
export const OVERTIME_PREMIUM = 0.5; // 연장근로 가산 50%

const DAY_MIN = 1440;

export function isRealDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ''));
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isTime(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function parseWon(v) {
  const n = Number(String(v ?? '').replace(/[,\s원]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : NaN;
}

// 자정을 넘기는 근무(예: 22:00 ~ 02:00)를 처리합니다.
export function spanMinutes(start, end) {
  const span = toMinutes(end) - toMinutes(start);
  return span <= 0 ? span + DAY_MIN : span;
}

export function shiftMinutes(s) {
  return Math.max(0, spanMinutes(s.start, s.end) - s.breakMin);
}

const arr = (x) => (Array.isArray(x) ? x : []);

function uniqueById(list) {
  const seen = new Set();
  return list.filter((x) => {
    if (seen.has(x.id)) return false;
    seen.add(x.id);
    return true;
  });
}

export function sanitizeEmployee(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? '').slice(0, 64);
  const name = String(raw.name ?? '').trim().slice(0, 40);
  const wage = parseWon(raw.wage);
  if (!id || !name || !Number.isFinite(wage) || wage <= 0) return null;
  return { id, name, wage };
}

export function sanitizeShift(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? '').slice(0, 64);
  const empId = String(raw.empId ?? '').slice(0, 64);
  const date = String(raw.date ?? '');
  const start = String(raw.start ?? '');
  const end = String(raw.end ?? '');
  const breakMin = Number(raw.breakMin ?? 0);
  if (!id || !empId || !isRealDate(date) || !isTime(start) || !isTime(end) || start === end) return null;
  const span = spanMinutes(start, end);
  if (!Number.isInteger(breakMin) || breakMin < 0 || breakMin >= span) return null;
  return {
    id,
    empId,
    date,
    start,
    end,
    breakMin,
    memo: String(raw.memo ?? '').slice(0, 200),
  };
}

export function sanitizeState(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const employees = uniqueById(arr(r.employees).map(sanitizeEmployee).filter(Boolean));
  const ids = new Set(employees.map((e) => e.id));
  const shifts = uniqueById(
    arr(r.shifts)
      .map(sanitizeShift)
      .filter((s) => s && ids.has(s.empId)),
  );
  const minWage = parseWon(r.minWage);
  return {
    employees,
    shifts,
    minWage: Number.isFinite(minWage) && minWage > 0 ? minWage : null,
  };
}

// 주의 시작일(월요일) 날짜 문자열
export function weekStartOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const back = (dt.getUTCDay() + 6) % 7; // 월요일=0
  dt.setUTCDate(dt.getUTCDate() - back);
  return dt.toISOString().slice(0, 10);
}

const round1 = (x) => Math.round(x * 10) / 10;
const round2 = (x) => Math.round(x * 100) / 100;

// 직원 × 주 단위 집계. 주휴수당과 연장근로 가산은 주 단위로 계산합니다.
export function weeklyReport(shifts, employees) {
  const emp = new Map(employees.map((e) => [e.id, e]));
  const groups = new Map();
  for (const s of shifts) {
    const e = emp.get(s.empId);
    if (!e) continue;
    const weekStart = weekStartOf(s.date);
    const key = `${s.empId}|${weekStart}`;
    const g = groups.get(key) ?? { empId: s.empId, name: e.name, wage: e.wage, weekStart, minutes: 0 };
    g.minutes += shiftMinutes(s);
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => {
      const hours = g.minutes / 60;
      const overtimeHours = Math.max(0, hours - WEEKLY_STANDARD_HOURS);
      const holidayHours =
        hours >= WEEKLY_HOLIDAY_MIN_HOURS
          ? Math.min(HOLIDAY_HOURS_CAP, (hours / WEEKLY_STANDARD_HOURS) * HOLIDAY_HOURS_CAP)
          : 0;
      return {
        ...g,
        hours,
        overtimeHours,
        holidayHours,
        basePay: Math.round(hours * g.wage),
        overtimePay: Math.round(overtimeHours * g.wage * OVERTIME_PREMIUM),
        holidayPay: Math.round(holidayHours * g.wage),
      };
    })
    .sort((a, b) => (a.weekStart === b.weekStart ? a.name.localeCompare(b.name, 'ko') : a.weekStart < b.weekStart ? -1 : 1));
}

// 주 단위 결과를 "주 시작일이 속한 달" 기준으로 직원별 월 합계로 묶습니다.
export function monthlyReport(weeks) {
  const map = new Map();
  for (const w of weeks) {
    const month = w.weekStart.slice(0, 7);
    const key = `${w.empId}|${month}`;
    const r = map.get(key) ?? {
      empId: w.empId,
      name: w.name,
      month,
      hours: 0,
      basePay: 0,
      overtimePay: 0,
      holidayPay: 0,
      total: 0,
    };
    r.hours += w.hours;
    r.basePay += w.basePay;
    r.overtimePay += w.overtimePay;
    r.holidayPay += w.holidayPay;
    r.total = r.basePay + r.overtimePay + r.holidayPay;
    map.set(key, r);
  }
  return [...map.values()].sort((a, b) => {
    if (a.month !== b.month) return a.month < b.month ? 1 : -1;
    return a.name.localeCompare(b.name, 'ko');
  });
}

export function checkWarnings(weeks, employees, minWage) {
  const out = [];
  if (minWage) {
    for (const e of employees) {
      if (e.wage < minWage) {
        out.push({
          level: 'error',
          text: `${e.name}: 시급 ${e.wage.toLocaleString('ko-KR')}원이 설정한 최저임금(${minWage.toLocaleString('ko-KR')}원)보다 낮습니다.`,
        });
      }
    }
  }
  for (const w of weeks) {
    if (w.overtimeHours > 0) {
      out.push({
        level: 'info',
        text: `${w.name} · ${w.weekStart} 주: 주 ${round1(w.hours)}시간 근무, 40시간 초과분 ${round1(w.overtimeHours)}시간에 연장 가산이 붙습니다.`,
      });
    } else if (w.hours > 0 && w.hours < WEEKLY_HOLIDAY_MIN_HOURS) {
      out.push({
        level: 'info',
        text: `${w.name} · ${w.weekStart} 주: 주 ${round1(w.hours)}시간이라 주휴수당 대상이 아닙니다.`,
      });
    }
  }
  return out;
}

// 수식 주입 방지: = + - @ 탭 CR 로 시작하는 셀은 앞에 ' 를 붙입니다.
const FORMULA_RE = /^[=+\-@\t\r]/;
export function csvCell(v) {
  let s = String(v ?? '');
  if (FORMULA_RE.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function shiftsToCSV(shifts, employees) {
  const names = new Map(employees.map((e) => [e.id, e.name]));
  const head = ['날짜', '직원', '시작', '종료', '휴게(분)', '근무시간(h)', '메모'];
  const rows = [...shifts]
    .sort((a, b) => (a.date === b.date ? (a.start < b.start ? -1 : 1) : a.date < b.date ? -1 : 1))
    .map((s) =>
      [s.date, names.get(s.empId) ?? '', s.start, s.end, s.breakMin, round2(shiftMinutes(s) / 60), s.memo]
        .map(csvCell)
        .join(','),
    );
  return '﻿' + [head.map(csvCell).join(','), ...rows].join('\r\n') + '\r\n';
}

export function monthlyToCSV(rows) {
  const head = ['월', '직원', '근무시간(h)', '기본급', '연장가산', '주휴수당', '합계'];
  const body = rows.map((r) =>
    [r.month, r.name, round2(r.hours), r.basePay, r.overtimePay, r.holidayPay, r.total].map(csvCell).join(','),
  );
  return '﻿' + [head.map(csvCell).join(','), ...body].join('\r\n') + '\r\n';
}
