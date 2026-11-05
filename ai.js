// AI 분석 브라우저 연동: 키 저장과 Anthropic Messages API 호출.
// 키는 사용자가 붙여넣은 값만 쓰며, api.anthropic.com 이외로는 보내지 않습니다.
// 호출은 사용자가 버튼을 눌렀을 때만 일어납니다 (app.js에서 제어).
import { AI_API_URL, AI_KEY_STORAGE, AI_MODEL } from './logic.js';

export function loadKey() {
  try {
    return localStorage.getItem(AI_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function saveKey(key) {
  try {
    localStorage.setItem(AI_KEY_STORAGE, key);
    return true;
  } catch {
    return false;
  }
}

export function clearKey() {
  try {
    localStorage.removeItem(AI_KEY_STORAGE);
    return true;
  } catch {
    return false;
  }
}

const MESSAGES = {
  401: 'API 키가 올바르지 않습니다. 키를 다시 확인하세요.',
  403: '이 키로는 요청이 허용되지 않습니다.',
  429: '요청이 너무 많습니다. 잠시 뒤 다시 시도하세요.',
};

/* Returns the parsed Messages API JSON. Throws an Error whose message is shown to the user. */
export async function requestAnalysis({ key, system, user }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let res;
  try {
    res = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 900,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(err?.name === 'AbortError' ? 'AI 응답이 너무 오래 걸려 중단했습니다.' : '네트워크 오류로 AI에 연결하지 못했습니다.');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(MESSAGES[res.status] || `AI 호출이 실패했습니다 (HTTP ${res.status}).`);
  }
  try {
    return await res.json();
  } catch {
    throw new Error('AI 응답을 읽을 수 없습니다.');
  }
}
