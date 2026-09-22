'use strict';
/**
 * Salvation CRM 공용 모듈 — Airtable(고객관리) · Telegram · 위기신호 판정
 *
 * 설계 근거: crm-schema.md / service-policy.md
 *  - 필드는 이름이 아니라 fieldId로 쓴다. Airtable UI에서 필드명을 바꿔도 깨지지 않는다.
 *  - 단일·다중 선택값은 아래 allowlist로 먼저 거른다. 베이스에 없는 선택지를 보내
 *    422로 레코드 자체가 유실되는 상황을 막는 것이 목적이다.
 *  - 토큰은 전부 환경변수. 정적 index.html에는 어떤 비밀값도 넣지 않는다.
 */

const BASE_ID  = process.env.AIRTABLE_BASE_ID || 'appHlpNTeCXrHKArz';
const AT_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY || '';
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT  = process.env.TELEGRAM_CHAT_ID || '';

/* ── 표 ─────────────────────────────────────────────────────────── */
const TBL = {
  leads: 'tbl6l91xSUbZbJSl6', // Leads
  risk:  'tbl6LffHjQePBYktS', // RiskEvents (대표 전용 열람)
};

/* ── 필드 ID ────────────────────────────────────────────────────── */
const F = {
  lead: {
    no:       'fldCF34czx402ImXP', // 문의번호
    name:     'fldWxbWEIhJu41xI7', // 이름
    phone:    'fldHyqFGXbfV1ifaw', // 연락처
    email:    'fldxVpO9IY8Q7OcG5', // 이메일
    company:  'flddRByWTQ5mmXRD1', // 회사
    message:  'fldxPoDLyCTMdRSVF', // 문의내용
    category: 'fldA1Yjum2fass2m8', // 문의구분
    source:   'fldb5jqLPQrqwACvP', // 유입경로
    chips:    'fldDN57N6y4GzA9eH', // 진입 상태칩
    status:   'fldALNuQazVbW2uLo', // 상태
    owner:    'fldSpBP59nDLnPgfq', // 담당자
    note:     'fldSKJOS9MAWs1pQN', // 비고
  },
  risk: {
    no:         'flduuPAPB1aiwrljg', // 사건번호
    type:       'fldtHyw4qjtCmt8Bs', // 사건유형
    clause:     'fld9GdxYhmVX0DAIC', // 근거조항
    detectedAt: 'fldhsutYJxiy6GEin', // 감지일시
    channel:    'fldXYps4yC7dSb1Mv', // 감지 경로
    halted:     'fld9cUvVBnfiAuZFC', // 즉시 중단 조치
    orgs:       'fldsvfC0gUc1IMi6F', // 안내한 기관
    action:     'fldxA1xoiUfffdEA0', // 조치
    confidex:   'fldK7XmyIY3jZMEQ0', // 비밀보호 예외 적용
    linked:     'fldwe7FVy8EXuTice', // 기관 연계 여부
    resumable:  'fldpVP5L7kma3rwUF', // 재개 가능
    actionDate: 'fld0VnXjPoshAXvYG', // 조치일
    log:        'fldoSfCDkHWtQ1Ou0', // 기록
    handler:    'fld3vHBQVl7GSJDcA', // 처리자
  },
};

/* ── 선택지 allowlist (베이스 스키마와 1:1) ─────────────────────── */
const OPT = {
  category: ['개인·심층컨설팅', '개인·단건리포트', '개인·구독', '조직·워크숍', '조직·프로그램', '제휴·협업', '일반문의'],
  source:   ['웹 문의폼', '상담챗봇', '오늘의말씀', '말씀받기 체험', '레터', '검색·SNS', '추천·소개', '외부제휴', '직접연락'],
  chips:    ['투자 손실', '시험 불안', '지치고 번아웃', '관계의 상처', '결정이 어렵습니다', '돈 걱정', '미래가 막막', '화가 납니다', '자꾸 비교됩니다', '미루게 됩니다'],
  riskType:    ['자살·자해 신호', '타인 가해 의도', '학대 피해 노출', '급성 정신질환 증상'],
  riskChannel: ['플랫폼 문답 입력', '세션 중 진술', '사전 질문지', '이메일·문의', '시스템 로그', '제3자 제보'],
};

const pick     = (v, list) => (list.indexOf(v) >= 0 ? v : null);
const pickMany = (arr, list) => (Array.isArray(arr) ? arr.filter(v => list.indexOf(v) >= 0) : []);

/* ── 입력 정리 ──────────────────────────────────────────────────── */
function clean(v, max) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max || 500);
}
const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

/* ── Airtable REST ──────────────────────────────────────────────── */
async function airtable(path, init) {
  if (!AT_TOKEN) throw new Error('AIRTABLE_TOKEN 환경변수가 설정되지 않았습니다.');
  const res = await fetch('https://api.airtable.com/v0/' + BASE_ID + path, Object.assign({
    headers: {
      Authorization: 'Bearer ' + AT_TOKEN,
      'Content-Type': 'application/json',
    },
  }, init || {}));
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) { /* 비 JSON 응답 */ }
  if (!res.ok) {
    const msg = (json && json.error && (json.error.message || json.error.type)) || text || ('HTTP ' + res.status);
    const err = new Error('Airtable ' + res.status + ': ' + msg);
    err.status = res.status;
    throw err;
  }
  return json;
}

/**
 * 연도별 일련번호 채번. 예) L-2026-0007
 * 같은 접두사를 가진 레코드를 훑어 최대값 + 1 을 쓴다.
 * Airtable에는 시퀀스가 없고 autoNumber는 연도 리셋이 불가능하다.
 */
async function nextSerial(tableId, fieldId, prefix) {
  const year = new Date().getFullYear();
  const head = prefix + '-' + year + '-';
  let max = 0, offset = null, guard = 0;
  do {
    const qs = new URLSearchParams();
    qs.set('pageSize', '100');
    qs.append('fields[]', fieldId);
    qs.set('filterByFormula', 'LEFT({' + fieldId + '}, ' + head.length + ') = "' + head + '"');
    if (offset) qs.set('offset', offset);
    let page;
    try {
      page = await airtable('/' + tableId + '?' + qs.toString());
    } catch (e) {
      // 채번 조회 실패가 접수 자체를 막아서는 안 된다. 타임스탬프로 폴백한다.
      return head + String(Date.now() % 10000).padStart(4, '0');
    }
    (page.records || []).forEach(r => {
      const v = r.fields && r.fields[fieldId];
      const m = v && String(v).match(/(\d+)\s*$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    offset = page.offset;
  } while (offset && ++guard < 20);
  return head + String(max + 1).padStart(4, '0');
}

/* ── Telegram ───────────────────────────────────────────────────── */
const tgReady = () => Boolean(TG_TOKEN && TG_CHAT);

function tgEscape(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 알림 실패가 접수 실패로 번지지 않도록, 던지지 않고 결과만 돌려준다. */
async function telegram(html, opts) {
  if (!tgReady()) return { ok: false, skipped: 'TELEGRAM 환경변수 미설정' };
  const chats = String(TG_CHAT).split(',').map(s => s.trim()).filter(Boolean);
  const results = [];
  for (const chat_id of chats) {
    try {
      const res = await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id,
          text: html,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          disable_notification: !(opts && opts.urgent),
        }),
      });
      const j = await res.json().catch(() => null);
      results.push({ chat_id, ok: Boolean(j && j.ok), error: j && j.description });
    } catch (e) {
      results.push({ chat_id, ok: false, error: String((e && e.message) || e) });
    }
  }
  return { ok: results.some(r => r.ok), results };
}

/* ── 위기 신호 판정 (service-policy.md §14.1) ───────────────────── */
const CRISIS = [
  { type: '자살·자해 신호', re: /(자살|극단적\s*선택|죽고\s*싶|죽어\s*버리고\s*싶|살고\s*싶지\s*않|살기\s*싫|사라지고\s*싶|없어지고\s*싶|목숨을\s*끊|목\s*을?\s*매|뛰어내리|투신|유서|수면제를?\s*모으|약을\s*모으|자해|손목을?\s*긋)/ },
  { type: '타인 가해 의도', re: /(죽여\s*버리|해치고\s*싶|칼로\s*찌르|불을\s*지르|보복하겠|복수하겠)/ },
  { type: '학대 피해 노출', re: /(학대\s*(당|받|를\s*당)|성폭행|성추행|강간|맞고\s*있|폭행\s*당|감금\s*당|가정\s*폭력)/ },
];

function detectCrisis(text) {
  const s = String(text || '').replace(/\s+/g, ' ');
  if (!s) return null;
  for (const c of CRISIS) if (c.re.test(s)) return c.type;
  return null;
}

/** §14.2② 전문기관 정보. 화면 안내와 RiskEvents 기록이 같은 목록을 쓴다. */
const RESOURCES = [
  { name: '자살예방 상담전화', tel: '109',       note: '24시간 · 무료' },
  { name: '정신건강 상담전화', tel: '1577-0199', note: '24시간 · 지역 정신건강복지센터' },
  { name: '생명의전화',        tel: '1588-9191', note: '24시간' },
  { name: '청소년 전화',       tel: '1388',      note: '24시간 · 만 9~24세' },
  { name: '응급의료',          tel: '119',       note: '생명이 위급할 때' },
];
const RESOURCE_OPTS = ['자살예방 상담전화 109', '정신건강 상담전화 1577-0199', '생명의전화 1588-9191', '응급 119'];

/**
 * 위기 사건 기록.
 * §8.2 민감정보 보관 동의가 없는 익명 유입이므로 입력 원문은 저장하지 않는다.
 * 감지 사실 · 조치 · 안내 기관만 남긴다.
 */
async function logRiskEvent(kind, channelHint) {
  const type = pick(kind, OPT.riskType) || '자살·자해 신호';
  const channel = pick(channelHint, OPT.riskChannel) || '플랫폼 문답 입력';
  const now = new Date();
  const no = await nextSerial(TBL.risk, F.risk.no, 'RE');

  const fields = {};
  fields[F.risk.no]         = no;
  fields[F.risk.type]       = type;
  fields[F.risk.clause]     = '§14 위기대응';
  fields[F.risk.detectedAt] = now.toISOString();
  fields[F.risk.channel]    = channel;
  fields[F.risk.halted]     = true;
  fields[F.risk.orgs]       = RESOURCE_OPTS;
  fields[F.risk.action]     = '안내 후 종료';
  fields[F.risk.confidex]   = '미적용';
  fields[F.risk.linked]     = false;
  fields[F.risk.resumable]  = '본인 요청 시 재개';
  fields[F.risk.actionDate] = now.toISOString().slice(0, 10);
  fields[F.risk.handler]    = '운영';
  fields[F.risk.log] =
    '웹 ' + (channel === '이메일·문의' ? '문의폼' : '상담챗봇') + ' 자동 감지(키워드 기반).\n' +
    '§14.2① 해석·성찰 작업 즉시 중단, §14.2② 전문기관 정보 안내 후 종료.\n' +
    '§8.2 민감정보 보관 동의가 없는 익명 유입이므로 입력 원문은 저장하지 않았다.\n' +
    '자동 기록이므로 §14.1 실제 위기 여부는 대표 확인이 필요하다.';

  const created = await airtable('/' + TBL.risk, {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }], typecast: false }),
  });

  await telegram(
    '🚨 <b>위기 신호 감지</b>\n' +
    '<b>사건번호</b> ' + tgEscape(no) + '\n' +
    '<b>유형</b> ' + tgEscape(type) + '\n' +
    '<b>경로</b> ' + tgEscape(channel) + '\n' +
    '<b>시각</b> ' + tgEscape(kstStamp(now)) + '\n\n' +
    '화면에는 전문기관 안내가 노출되었고 상담 흐름은 중단되었습니다.\n' +
    '<i>§8.2에 따라 입력 원문은 저장·전송하지 않습니다. RiskEvents에서 확인하세요.</i>',
    { urgent: true }
  );

  return {
    no,
    type,
    recordId: created && created.records && created.records[0] && created.records[0].id,
  };
}

/* ── 유틸 ───────────────────────────────────────────────────────── */
function kstStamp(d) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short',
  }).format(d || new Date());
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

/** 같은 오리진이면 CORS가 필요 없다. 외부 호스팅(GitHub Pages 등) 대비만 한다. */
function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  const allow = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const ok = allow.indexOf(origin) >= 0 ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.github\.io$/i.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/i.test(origin);
  if (!ok) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/* ── 동일 IP 간이 스로틀 ────────────────────────────────────────── */
const hits = new Map();
function throttled(req, limit, windowMs) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 2000) hits.clear();
  return arr.length > limit;
}

module.exports = {
  BASE_ID, TBL, F, OPT, RESOURCES, RESOURCE_OPTS,
  pick, pickMany, clean, isEmail,
  airtable, nextSerial,
  telegram, tgEscape, tgReady,
  detectCrisis, logRiskEvent,
  kstStamp, readBody, applyCors, throttled,
};
