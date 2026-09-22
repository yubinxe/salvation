'use strict';
/**
 * POST /api/risk — 위기 신호 기록
 *
 * 챗봇은 사용자가 문장을 입력하는 즉시 화면에서 위기 신호를 판정하고 흐름을 멈춘다
 * (service-policy.md §14.2① 해석·성찰 작업 즉시 중단). 그때 이 엔드포인트로 사실만 남긴다.
 *
 * 본문(text)은 서버 판정용으로만 쓰고 어디에도 저장하지 않는다 (§8.2).
 * 저장되는 것은 감지 유형 · 시각 · 조치 · 안내 기관뿐이다.
 */

const crm = require('./_crm.js');

module.exports = async function handler(req, res) {
  crm.applyCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ ok: false, error: 'POST만 허용됩니다.' });
    return;
  }
  if (crm.throttled(req, 8, 60 * 1000)) {
    // 화면 안내는 이미 떠 있다. 중복 기록만 막고 정상 응답한다.
    res.status(200).json({ ok: true, throttled: true, resources: crm.RESOURCES });
    return;
  }

  let body = {};
  try { body = await crm.readBody(req); } catch (_) { body = {}; }

  const text = crm.clean(body.text, 2000);
  const hinted = crm.pick(crm.clean(body.type, 40), crm.OPT.riskType);
  const type = hinted || crm.detectCrisis(text);

  if (!type) {
    res.status(200).json({ ok: true, crisis: false });
    return;
  }

  const channel = crm.pick(crm.clean(body.channel, 40), crm.OPT.riskChannel) || '플랫폼 문답 입력';

  let ev = null, error = null;
  try {
    ev = await crm.logRiskEvent(type, channel);
  } catch (e) {
    error = String((e && e.message) || e);
    try {
      await crm.telegram(
        '🚨 <b>위기 신호 감지 (기록 실패)</b>\n' +
        '유형 ' + crm.tgEscape(type) + '\n' +
        '시각 ' + crm.tgEscape(crm.kstStamp()) + '\n' +
        'RiskEvents 기록에 실패했습니다: ' + crm.tgEscape(error),
        { urgent: true }
      );
    } catch (_) { /* 무시 */ }
  }

  // 기록에 실패하더라도 화면 안내가 막히면 안 되므로 항상 200으로 응답한다.
  res.status(200).json({
    ok: true,
    crisis: true,
    type,
    no: ev && ev.no,
    logged: Boolean(ev),
    resources: crm.RESOURCES,
  });
};
