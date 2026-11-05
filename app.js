import {
  checkWarnings,
  monthlyReport,
  monthlyToCSV,
  parseWon,
  sanitizeEmployee,
  sanitizeShift,
  sanitizeState,
  shiftMinutes,
  shiftsToCSV,
  spanMinutes,
  weeklyReport,
} from './logic.js';

const KEY = 'workbook-v1';
const $ = (sel) => document.querySelector(sel);
const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const hrs = (minutes) => `${Math.round((minutes / 60) * 10) / 10}시간`;
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const currentMonth = () => new Date().toISOString().slice(0, 7);

const shiftForm = $('#shift-form');
const empForm = $('#emp-form');

let state = load();
let month = currentMonth();
let editingShiftId = null;

function load() {
  try {
    return sanitizeState(JSON.parse(localStorage.getItem(KEY) || 'null'));
  } catch {
    return sanitizeState(null);
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    toast('브라우저 저장소에 쓸 수 없어 저장하지 못했습니다.');
  }
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    t.hidden = true;
  }, 2600);
}

function td(text, cls) {
  const c = document.createElement('td');
  c.textContent = text;
  if (cls) c.className = cls;
  return c;
}

function btn(label, onClick, cls = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  if (cls) b.className = cls;
  b.addEventListener('click', onClick);
  return b;
}

const empName = (id) => state.employees.find((e) => e.id === id)?.name ?? '(삭제된 직원)';

function renderMonthOptions() {
  const months = new Set([currentMonth(), ...state.shifts.map((s) => s.date.slice(0, 7))]);
  const sorted = [...months].sort().reverse();
  if (!sorted.includes(month)) month = sorted[0];
  const sel = $('#month-sel');
  sel.replaceChildren(...sorted.map((m) => new Option(m, m)));
  sel.value = month;
}

function renderSettings() {
  const input = $('#min-wage');
  if (document.activeElement !== input) {
    input.value = state.minWage ? state.minWage.toLocaleString('ko-KR') : '';
  }
}

function renderEmployees() {
  const list = $('#emp-list');
  list.replaceChildren();
  if (!state.employees.length) {
    const li = document.createElement('li');
    li.className = 'hint';
    li.textContent = '등록된 직원이 없습니다.';
    list.append(li);
  }
  for (const e of state.employees) {
    const li = document.createElement('li');
    const info = document.createElement('span');
    info.textContent = `${e.name} · 시급 ${won(e.wage)}`;
    li.append(info, btn('시급 수정', () => editWage(e.id)), btn('삭제', () => removeEmployee(e.id), 'danger'));
    list.append(li);
  }
  const sel = shiftForm.elements.empId;
  const keep = sel.value;
  sel.replaceChildren(...state.employees.map((e) => new Option(e.name, e.id)));
  if (state.employees.some((e) => e.id === keep)) sel.value = keep;
}

function renderCards(monthly) {
  const sum = (k) => monthly.reduce((a, r) => a + r[k], 0);
  $('#c-hours').textContent = hrs(sum('hours') * 60);
  $('#c-base').textContent = won(sum('basePay'));
  $('#c-ot').textContent = won(sum('overtimePay'));
  $('#c-holiday').textContent = won(sum('holidayPay'));
  $('#c-total').textContent = won(sum('total'));
}

function renderWarnings(weeks) {
  const list = $('#warnings');
  const items = checkWarnings(weeks, state.employees, state.minWage);
  list.replaceChildren(
    ...items.map((w) => {
      const li = document.createElement('li');
      li.className = w.level;
      li.textContent = `${w.level === 'error' ? '⚠ ' : 'ℹ '}${w.text}`;
      return li;
    }),
  );
  $('#warn-empty').hidden = items.length > 0;
  $('#warn-panel').hidden = !state.employees.length && !items.length;
}

function renderWeeks(weeks) {
  const body = $('#weeks');
  body.replaceChildren();
  for (const w of weeks) {
    const tr = document.createElement('tr');
    tr.append(
      td(w.weekStart),
      td(w.name),
      td(hrs(w.minutes), 'num'),
      td(w.overtimeHours > 0 ? hrs(w.overtimeHours * 60) : '-', 'num'),
      td(w.holidayHours > 0 ? `${Math.round(w.holidayHours * 10) / 10}시간` : '-', 'num'),
      td(won(w.basePay + w.overtimePay + w.holidayPay), 'num'),
    );
    body.append(tr);
  }
  $('#weeks-empty').hidden = weeks.length > 0;
}

function renderMonthly(monthly) {
  const body = $('#monthly');
  body.replaceChildren();
  for (const r of monthly) {
    const tr = document.createElement('tr');
    tr.append(
      td(r.name),
      td(hrs(r.hours * 60), 'num'),
      td(won(r.basePay), 'num'),
      td(won(r.overtimePay), 'num'),
      td(won(r.holidayPay), 'num'),
      td(won(r.total), 'num'),
    );
    body.append(tr);
  }
}

function renderShifts() {
  const list = state.shifts
    .filter((s) => s.date.startsWith(month))
    .sort((a, b) => (a.date === b.date ? (a.start < b.start ? 1 : -1) : a.date < b.date ? 1 : -1));
  const body = $('#shifts');
  body.replaceChildren();
  for (const s of list) {
    const info = document.createElement('small');
    info.textContent = s.breakMin ? `휴게 ${s.breakMin}분` : '';
    const tr = document.createElement('tr');
    tr.append(
      td(s.date),
      td(empName(s.empId)),
      td(`${s.start} ~ ${s.end}`),
      td(hrs(shiftMinutes(s)), 'num'),
      td(s.memo || ''),
      (() => {
        const c = td('', 'actions-cell');
        c.append(btn('수정', () => startEditShift(s.id)), btn('삭제', () => removeShift(s.id), 'danger'));
        return c;
      })(),
    );
    body.append(tr);
  }
  $('#shifts-empty').hidden = list.length > 0;
}

function render() {
  renderMonthOptions();
  renderSettings();
  renderEmployees();
  const weeks = weeklyReport(state.shifts, state.employees).filter((w) => w.weekStart.startsWith(month));
  const monthly = monthlyReport(weeks);
  renderCards(monthly);
  renderWarnings(weeks);
  renderWeeks(weeks);
  renderMonthly(monthly);
  renderShifts();
}

// ── 직원 ──
function editWage(id) {
  const e = state.employees.find((x) => x.id === id);
  if (!e) return;
  const input = prompt(`${e.name}님의 새 시급(원)`, String(e.wage));
  if (input === null) return;
  const wage = parseWon(input);
  if (!Number.isFinite(wage) || wage <= 0) {
    toast('시급은 0보다 큰 숫자로 입력하세요.');
    return;
  }
  state.employees = state.employees.map((x) => (x.id === id ? { ...x, wage } : x));
  save();
  render();
  toast('시급을 수정했습니다.');
}

function removeEmployee(id) {
  const e = state.employees.find((x) => x.id === id);
  if (!e) return;
  const count = state.shifts.filter((s) => s.empId === id).length;
  if (!confirm(`${e.name}님과 근무 기록 ${count}건을 모두 삭제합니다. 계속할까요?`)) return;
  state.employees = state.employees.filter((x) => x.id !== id);
  state.shifts = state.shifts.filter((s) => s.empId !== id);
  save();
  render();
  toast('직원을 삭제했습니다.');
}

empForm.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const emp = sanitizeEmployee({
    id: newId(),
    name: empForm.elements.name.value,
    wage: empForm.elements.wage.value,
  });
  if (!emp) {
    toast('이름과 시급(0보다 큰 숫자)을 확인하세요.');
    return;
  }
  state.employees.push(emp);
  save();
  empForm.reset();
  render();
  toast(`${emp.name}님을 추가했습니다.`);
});

$('#min-wage').addEventListener('change', (ev) => {
  const v = parseWon(ev.target.value);
  state.minWage = Number.isFinite(v) && v > 0 ? v : null;
  save();
  render();
});

// ── 근무 기록 ──
function updatePreview() {
  const f = shiftForm.elements;
  const preview = $('#preview');
  const span = f.start.value && f.end.value && f.start.value !== f.end.value
    ? spanMinutes(f.start.value, f.end.value)
    : null;
  if (span === null) {
    preview.textContent = '출근과 퇴근 시각을 입력하세요. 퇴근이 출근보다 이르면 다음 날로 계산합니다.';
    return;
  }
  const brk = Number(f.breakMin.value || 0);
  if (!Number.isInteger(brk) || brk < 0 || brk >= span) {
    preview.textContent = '휴게 시간이 근무 시간보다 길거나 올바르지 않습니다.';
    return;
  }
  preview.textContent = `실근무 ${hrs(span - brk)} (근무 ${hrs(span)} − 휴게 ${brk}분)`;
}

function resetShiftForm() {
  const keepEmp = shiftForm.elements.empId.value;
  shiftForm.reset();
  shiftForm.elements.empId.value = keepEmp;
  editingShiftId = null;
  $('#shift-title').textContent = '근무 기록 입력';
  $('#shift-submit').textContent = '기록 추가';
  $('#shift-cancel').hidden = true;
  updatePreview();
}

function startEditShift(id) {
  const s = state.shifts.find((x) => x.id === id);
  if (!s) return;
  editingShiftId = id;
  const f = shiftForm.elements;
  f.empId.value = s.empId;
  f.date.value = s.date;
  f.start.value = s.start;
  f.end.value = s.end;
  f.breakMin.value = String(s.breakMin);
  f.memo.value = s.memo;
  $('#shift-title').textContent = '근무 기록 수정';
  $('#shift-submit').textContent = '저장';
  $('#shift-cancel').hidden = false;
  updatePreview();
  f.start.focus();
}

function removeShift(id) {
  const s = state.shifts.find((x) => x.id === id);
  if (!s) return;
  if (!confirm(`${s.date} ${empName(s.empId)} 근무 기록을 삭제할까요?`)) return;
  state.shifts = state.shifts.filter((x) => x.id !== id);
  if (editingShiftId === id) resetShiftForm();
  save();
  render();
  toast('삭제했습니다.');
}

shiftForm.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = shiftForm.elements;
  const wasEdit = editingShiftId !== null;
  const shift = sanitizeShift({
    id: editingShiftId ?? newId(),
    empId: f.empId.value,
    date: f.date.value,
    start: f.start.value,
    end: f.end.value,
    breakMin: Number(f.breakMin.value || 0),
    memo: f.memo.value.trim(),
  });
  if (!shift) {
    toast('날짜·출퇴근 시각을 확인하세요. 출근과 퇴근이 같거나 휴게가 근무 시간보다 길 수 없습니다.');
    return;
  }
  if (wasEdit) {
    state.shifts = state.shifts.map((s) => (s.id === shift.id ? shift : s));
  } else {
    state.shifts.push(shift);
  }
  month = shift.date.slice(0, 7);
  resetShiftForm();
  save();
  render();
  toast(wasEdit ? '수정했습니다.' : '기록했습니다.');
});

shiftForm.addEventListener('input', updatePreview);
$('#shift-cancel').addEventListener('click', resetShiftForm);

// ── 월 선택 · 내보내기 ──
$('#month-sel').addEventListener('change', (ev) => {
  month = ev.target.value;
  render();
});

$('#export-shifts').addEventListener('click', () => {
  const list = state.shifts.filter((s) => s.date.startsWith(month));
  if (!list.length) {
    toast(`${month} 기록이 없습니다.`);
    return;
  }
  download(shiftsToCSV(list, state.employees), `근무기록-${month}.csv`);
});

$('#export-monthly').addEventListener('click', () => {
  const weeks = weeklyReport(state.shifts, state.employees).filter((w) => w.weekStart.startsWith(month));
  const monthly = monthlyReport(weeks);
  if (!monthly.length) {
    toast(`${month} 집계할 기록이 없습니다.`);
    return;
  }
  download(monthlyToCSV(monthly), `근무집계-${month}.csv`);
});

function download(text, filename) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 초기화
shiftForm.elements.date.value = currentMonth() + '-01';
updatePreview();
render();
