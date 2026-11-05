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

/* ───────── AI 분석 (순수 함수: 프롬프트 구성, 응답 파싱, 로컬 대체 분석) ─────────
   AI에는 직원 이름·메모를 보내지 않습니다. 직원은 "직원 N" 익명 번호로만 표시합니다. */

export const AI_MODEL = 'claude-haiku-5-5';
export const AI_KEY_STORAGE = 'lendnest-ai-key';
export const AI_API_URL = 'https://api.anthropic.com/v1/messages';

export const AI_SYSTEM_PROMPT = [
  '당신은 한국 소상공인의 근무시간·급여를 점검하는 도우미입니다.',
  '입력은 한 달치 근무 집계 JSON입니다. 직원은 익명 번호(직원 N)로만 주어집니다.',
  '근로기준법 기준으로 쉬운 한국어로 설명하세요. 모든 계산은 추정이며 법률 자문이 아니라는 전제로 답하세요.',
  '입력에 없는 사실을 지어내지 마세요. 확신이 없는 법적 판단은 level을 info로 두고 "확인 필요"라고 쓰세요.',
  '반드시 아래 형식의 JSON 객체 하나만 출력하세요. 코드 블록이나 다른 문장을 붙이지 마세요.',
  '{"summary": "2~3문장 요약", "issues": [{"level": "error|warn|info", "employee": "직원 N 또는 전체", "text": "문제와 근거 한 문장"}], "nextSteps": ["사장님이 할 일 한 문장"]}',
  'issues는 최대 6개, nextSteps는 최대 4개입니다.',
].join('\n');

/* Remove control characters, collapse whitespace, cap length. Used on every string that goes into a prompt or the UI. */
export function cleanText(v, max = 200) {
  return String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/* Anthropic keys look like sk-ant-api03-... Only a light shape check; the server decides validity. */
export function isPlausibleKey(v) {
  const k = String(v ?? '').trim();
  return /^sk-[A-Za-z0-9_-]{20,200}$/.test(k);
}

// 근로기준법 제54조: 근로 4시간 이상 30분, 8시간 이상 1시간 이상 휴게 (근로시간 기준 추정)
export function breakIssue(shift) {
  const work = shiftMinutes(shift);
  if (work >= 480 && shift.breakMin < 60) return 'break8';
  if (work >= 240 && shift.breakMin < 30) return 'break4';
  return null;
}

const krw = (n) => Math.round(n).toLocaleString('ko-KR');

/* Aggregate facts for one month. Returns the object sent to the model (`facts`) and a local-only `legend` mapping labels to names. */
export function buildPayFacts(month, shifts, employees, minWage) {
  const safeMonth = cleanText(month, 7);
  const monthShifts = shifts.filter((s) => s.date.startsWith(safeMonth));
  const weeks = weeklyReport(shifts, employees).filter((w) => w.weekStart.startsWith(safeMonth));
  const monthly = monthlyReport(weeks);
  const legend = [];
  const labelOf = new Map();
  for (const r of monthly) {
    if (labelOf.has(r.empId)) continue;
    const label = `직원 ${labelOf.size + 1}`;
    labelOf.set(r.empId, label);
    legend.push({ label, name: cleanText(r.name, 40) });
  }
  const people = monthly.map((r) => {
    const ws = weeks.filter((w) => w.empId === r.empId);
    const emp = employees.find((e) => e.id === r.empId);
    const mine = monthShifts.filter((s) => s.empId === r.empId);
    return {
      label: labelOf.get(r.empId),
      wage: emp ? emp.wage : 0,
      hours: Math.round(r.hours * 10) / 10,
      basePay: r.basePay,
      overtimePay: r.overtimePay,
      holidayPay: r.holidayPay,
      total: r.total,
      weeks: ws.length,
      overtimeWeeks: ws.filter((w) => w.overtimeHours > 0).length,
      shortWeeks: ws.filter((w) => w.hours > 0 && w.hours < WEEKLY_HOLIDAY_MIN_HOURS).length,
      maxWeekHours: Math.round(Math.max(0, ...ws.map((w) => w.hours)) * 10) / 10,
      belowMinWage: !!minWage && !!emp && emp.wage < minWage,
      breakShort8: mine.filter((s) => breakIssue(s) === 'break8').length,
      breakShort4: mine.filter((s) => breakIssue(s) === 'break4').length,
    };
  });
  const sum = (k) => people.reduce((a, p) => a + p[k], 0);
  const facts = {
    month: safeMonth,
    minWage: minWage || null,
    people,
    totals: { basePay: sum('basePay'), overtimePay: sum('overtimePay'), holidayPay: sum('holidayPay'), total: sum('total') },
  };
  return { facts, legend };
}

/* Deterministic checks shared by the local panel. Each item has a level, a label (or 전체) and a plain Korean text. */
export function lawFlags(facts) {
  const out = [];
  for (const p of facts.people) {
    if (p.belowMinWage) {
      out.push({ level: 'error', label: p.label, text: `시급 ${krw(p.wage)}원이 설정한 최저임금(${krw(facts.minWage)}원)보다 낮습니다.` });
    }
    if (p.breakShort8 + p.breakShort4 > 0) {
      out.push({
        level: 'warn',
        label: p.label,
        text: `휴게시간이 부족한 근무가 ${p.breakShort8 + p.breakShort4}건 있습니다 (근로 8시간 이상 휴게 60분, 4시간 이상 30분, 근로기준법 제54조). 추정입니다.`,
      });
    }
    if (p.maxWeekHours > 52) {
      out.push({
        level: 'warn',
        label: p.label,
        text: `한 주 근무가 ${p.maxWeekHours}시간이라 주 52시간 상한(근로기준법 제53조)을 넘을 수 있습니다. 5인 이상 사업장 기준입니다.`,
      });
    }
    if (p.overtimeWeeks > 0) {
      out.push({ level: 'info', label: p.label, text: `주 40시간을 넘긴 주가 ${p.overtimeWeeks}주 있어 연장 가산이 붙습니다.` });
    }
    if (p.shortWeeks > 0) {
      out.push({ level: 'info', label: p.label, text: `주 15시간 미만인 주가 ${p.shortWeeks}주 있어 그 주는 주휴수당 대상이 아닙니다.` });
    }
  }
  return out;
}

/* Result shape shared by the local fallback and the AI answer: { summary, issues, nextSteps, source }. */
export function localPayAnalysis(facts) {
  const n = facts.people.length;
  const summary = n
    ? `${facts.month} 기준 ${n}명, 예상 지급 합계 ${krw(facts.totals.total)}원(세금·공제 전, 추정). 연장 가산 ${krw(facts.totals.overtimePay)}원, 주휴수당 ${krw(facts.totals.holidayPay)}원입니다.`
    : `${facts.month}에는 근무 기록이 없어 분석할 내용이 없습니다.`;
  return {
    summary,
    issues: lawFlags(facts).map((f) => ({ level: f.level, employee: f.label, text: f.text })),
    nextSteps: [
      '휴게시간과 근무 시각은 실제 기록(출입 기록, 근무표)과 맞는지 확인하세요.',
      '근로계약서의 소정근로시간과 주휴수당 개근 조건을 확인하세요.',
      '최저임금과 가산율은 고용노동부 고시와 노무사 상담으로 최종 확인하세요.',
    ],
    source: 'local',
  };
}

export function buildAnalysisPrompt(facts) {
  return {
    system: AI_SYSTEM_PROMPT,
    user: `다음은 ${cleanText(facts.month, 7)} 근무 집계(JSON)입니다.\n${JSON.stringify(facts, null, 1)}`,
  };
}

function normIssue(x) {
  if (!x || typeof x !== 'object') return null;
  const text = cleanText(x.text, 300);
  if (!text) return null;
  return {
    level: ['error', 'warn', 'info'].includes(x.level) ? x.level : 'info',
    employee: cleanText(x.employee, 20) || '전체',
    text,
  };
}

/* Parses the model's text. Accepts bare JSON, fenced JSON, or plain prose (kept as the summary). Returns null for empty text. */
export function parseAnalysisText(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  const body = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const o = JSON.parse(body.slice(start, end + 1));
      if (o && typeof o === 'object' && !Array.isArray(o)) {
        return {
          summary: cleanText(o.summary, 600),
          issues: (Array.isArray(o.issues) ? o.issues : []).slice(0, 6).map(normIssue).filter(Boolean),
          nextSteps: (Array.isArray(o.nextSteps) ? o.nextSteps : [])
            .filter((s) => typeof s === 'string')
            .slice(0, 4)
            .map((s) => cleanText(s, 200))
            .filter(Boolean),
          source: 'ai',
        };
      }
    } catch {
      /* fall through to plain text */
    }
  }
  return { summary: cleanText(raw, 800), issues: [], nextSteps: [], source: 'ai-text' };
}

/* Messages API response -> analysis. Only text blocks are used; thinking blocks are ignored. */
export function parseAnalysisResponse(data) {
  const blocks = Array.isArray(data?.content) ? data.content : [];
  const text = blocks
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n');
  return parseAnalysisText(text);
}
