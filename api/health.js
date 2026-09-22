'use strict';
/**
 * GET /api/health — 연동 점검용. 비밀값은 절대 응답에 넣지 않는다.
 *
 *   /api/health        환경변수 설정 여부만 확인 (공개해도 무해)
 *   /api/health?deep=1 Airtable·Telegram에 실제로 한 번씩 붙어 본다
 *                      (ADMIN_KEY 환경변수를 설정했다면 ?key=... 필요)
 */

const crm = require('./_crm.js');

const mask = v => (v ? '설정됨(' + String(v).length + '자)' : '없음');

module.exports = async function handler(req, res) {
  crm.applyCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const out = {
    ok: true,
    time: crm.kstStamp() + ' (KST)',
    baseId: crm.BASE_ID,
    env: {
      AIRTABLE_TOKEN:     mask(process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY),
      AIRTABLE_BASE_ID:   process.env.AIRTABLE_BASE_ID ? '설정됨' : '기본값 사용',
      TELEGRAM_BOT_TOKEN: mask(process.env.TELEGRAM_BOT_TOKEN),
      TELEGRAM_CHAT_ID:   process.env.TELEGRAM_CHAT_ID ? '설정됨' : '없음',
    },
  };

  const wantDeep = String((req.query && req.query.deep) || '') === '1';
  if (!wantDeep) { res.status(200).json(out); return; }

  const adminKey = process.env.ADMIN_KEY || '';
  if (adminKey && String((req.query && req.query.key) || '') !== adminKey) {
    res.status(401).json({ ok: false, error: 'ADMIN_KEY가 일치하지 않습니다.' });
    return;
  }

  // Airtable 읽기 1회
  try {
    const r = await crm.airtable('/' + crm.TBL.leads + '?pageSize=1&fields%5B%5D=' + crm.F.lead.no);
    out.airtable = { ok: true, sample: (r.records || []).length };
  } catch (e) {
    out.ok = false;
    out.airtable = { ok: false, error: String((e && e.message) || e) };
  }

  // Telegram getMe 1회 (메시지는 보내지 않는다)
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    out.telegram = { ok: false, error: 'TELEGRAM_BOT_TOKEN 없음' };
    out.ok = false;
  } else {
    try {
      const r = await fetch('https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN + '/getMe');
      const j = await r.json();
      out.telegram = j && j.ok
        ? { ok: true, bot: j.result && j.result.username, chatIdSet: Boolean(process.env.TELEGRAM_CHAT_ID) }
        : { ok: false, error: (j && j.description) || 'getMe 실패' };
      if (!out.telegram.ok || !process.env.TELEGRAM_CHAT_ID) out.ok = false;
    } catch (e) {
      out.ok = false;
      out.telegram = { ok: false, error: String((e && e.message) || e) };
    }
  }

  res.status(out.ok ? 200 : 503).json(out);
};
