'use strict';
/**
 * POST /api/lead — 상담·문의 접수
 *
 * 웹 문의폼과 상담챗봇이 같은 엔드포인트를 쓴다. 구분은 body.source(유입경로)로 한다.
 * 처리 순서
 *   1) 위기 신호 판정 → 감지되면 접수를 중단하고 RiskEvents만 남긴다 (service-policy.md §14.2①)
 *   2) 입력 검증 · 선택지 allowlist 통과
 *   3) Airtable Leads 레코드 생성 (문의번호 자동 채번)
 *   4) Telegram 알림 — 실패해도 접수는 성공으로 본다
 */

const crm = require('./_crm.js');

const AIRTABLE_UI = 'https://airtable.com/' + crm.BASE_ID + '/' + crm.TBL.leads + '/';

module.exports = async function handler(req, res) {
  crm.applyCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ ok: false, error: 'POST만 허용됩니다.' });
    return;
  }
  if (crm.throttled(req, 5, 60 * 1000)) {
    res.status(429).json({ ok: false, error: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
    return;
  }

  let body;
  try {
    body = await crm.readBody(req);
  } catch (_) {
    res.status(400).json({ ok: false, error: '요청 본문을 읽지 못했습니다.' });
    return;
  }

  // 봇 차단용 허니팟. 사람이 채울 수 없는 숨김 입력이 차 있으면 조용히 성공 응답만 준다.
  if (crm.clean(body.website, 100)) {
    res.status(200).json({ ok: true, no: null, skipped: true });
    return;
  }

  const source   = crm.pick(crm.clean(body.source, 40), crm.OPT.source) || '웹 문의폼';
  const chatbot  = source === '상담챗봇';
  const name     = crm.clean(body.name, 60);
  const email    = crm.clean(body.email, 120).toLowerCase();
  const phone    = crm.clean(body.phone, 40);
  const company  = crm.clean(body.company, 120);
  const message  = crm.clean(body.message, 4000);
  const category = crm.pick(crm.clean(body.category, 40), crm.OPT.category) || '일반문의';
  const chips    = crm.pickMany(body.chips, crm.OPT.chips);
  const agreed   = body.agree === true || body.agree === 'true';

  /* 1) 위기 신호 — service-policy.md §14.2① 즉시 중단 */
  const crisis = crm.detectCrisis(message);
  if (crisis) {
    let ev = null;
    try {
      ev = await crm.logRiskEvent(crisis, chatbot ? '플랫폼 문답 입력' : '이메일·문의');
    } catch (e) {
      // 기록 실패해도 화면 안내는 반드시 나가야 한다.
      try {
        await crm.telegram(
          '🚨 <b>위기 신호 감지 (기록 실패)</b>\n' +
          '유형 ' + crm.tgEscape(crisis) + '\n' +
          '시각 ' + crm.tgEscape(crm.kstStamp()) + '\n' +
          'RiskEvents 기록에 실패했습니다: ' + crm.tgEscape(String((e && e.message) || e)),
          { urgent: true }
        );
      } catch (_) { /* 무시 */ }
    }
    res.status(200).json({
      ok: true,
      crisis: true,
      type: crisis,
      no: ev && ev.no,
      resources: crm.RESOURCES,
      notice: '지금은 해석과 성찰보다 즉각적인 도움이 먼저입니다. 아래 기관은 24시간 연결됩니다.',
    });
    return;
  }

  /* 2) 검증 */
  const errors = [];
  if (!agreed) errors.push('개인정보 수집·이용 동의가 필요합니다.');
  if (name.length < 1) errors.push('이름을 입력해 주세요.');
  if (!email && !phone) errors.push('이메일 또는 연락처 중 하나는 입력해 주세요.');
  if (email && !crm.isEmail(email)) errors.push('이메일 형식이 올바르지 않습니다.');
  if (!chatbot && message.length < 5) errors.push('문의 내용을 5자 이상 적어 주세요.');
  if (errors.length) {
    res.status(400).json({ ok: false, error: errors[0], errors });
    return;
  }

  /* 3) Airtable 기록 */
  const F = crm.F.lead;
  let no, recordId;
  try {
    no = await crm.nextSerial(crm.TBL.leads, F.no, 'L');

    const fields = {};
    fields[F.no]       = no;
    fields[F.name]     = name;
    fields[F.source]   = source;
    fields[F.category] = category;
    fields[F.status]   = '신규';
    fields[F.owner]    = '미배정';
    if (email)   fields[F.email]   = email;
    if (phone)   fields[F.phone]   = phone;
    if (company) fields[F.company] = company;
    if (message) fields[F.message] = message;
    if (chips.length) fields[F.chips] = chips;
    fields[F.note] =
      '웹 접수 · ' + crm.kstStamp() + ' (KST)\n' +
      '개인정보 수집·이용 동의: 동의함\n' +
      '유입 화면: ' + (crm.clean(body.page, 200) || '-') + '\n' +
      '기기: ' + (crm.clean(req.headers['user-agent'], 200) || '-');

    const created = await crm.airtable('/' + crm.TBL.leads, {
      method: 'POST',
      body: JSON.stringify({ records: [{ fields }], typecast: false }),
    });
    recordId = created && created.records && created.records[0] && created.records[0].id;
  } catch (e) {
    // Airtable 기록에 실패하면 문의가 사라진다. 텔레그램으로라도 원문을 남긴다.
    await crm.telegram(
      '⚠️ <b>문의 접수 — Airtable 기록 실패</b>\n' +
      '<b>오류</b> ' + crm.tgEscape(String((e && e.message) || e)) + '\n\n' +
      '<b>이름</b> ' + crm.tgEscape(name) + '\n' +
      '<b>이메일</b> ' + crm.tgEscape(email || '-') + '\n' +
      '<b>연락처</b> ' + crm.tgEscape(phone || '-') + '\n' +
      '<b>구분</b> ' + crm.tgEscape(category) + ' · ' + crm.tgEscape(source) + '\n' +
      '<b>내용</b>\n' + crm.tgEscape(message.slice(0, 1500)),
      { urgent: true }
    );
    res.status(502).json({
      ok: false,
      error: '접수 처리 중 문제가 발생했습니다. 잠시 후 다시 시도하시거나 이메일로 보내 주세요.',
      detail: process.env.NODE_ENV === 'development' ? String((e && e.message) || e) : undefined,
    });
    return;
  }

  /* 4) Telegram 알림 (실패 무해) */
  const tg = await crm.telegram(
    (chatbot ? '💬' : '✉️') + ' <b>새 문의 ' + crm.tgEscape(no) + '</b>\n' +
    '<b>구분</b> ' + crm.tgEscape(category) + '\n' +
    '<b>유입</b> ' + crm.tgEscape(source) + '\n' +
    (chips.length ? '<b>상태</b> ' + crm.tgEscape(chips.join(' · ')) + '\n' : '') +
    '\n' +
    '<b>이름</b> ' + crm.tgEscape(name) + '\n' +
    (email   ? '<b>이메일</b> ' + crm.tgEscape(email) + '\n' : '') +
    (phone   ? '<b>연락처</b> ' + crm.tgEscape(phone) + '\n' : '') +
    (company ? '<b>회사</b> ' + crm.tgEscape(company) + '\n' : '') +
    (message ? '\n<b>내용</b>\n' + crm.tgEscape(message.slice(0, 1200)) + '\n' : '') +
    '\n<b>접수</b> ' + crm.tgEscape(crm.kstStamp()) + ' (KST)' +
    (recordId ? '\n<a href="' + AIRTABLE_UI + recordId + '">Airtable에서 열기</a>' : '') +
    '\n<i>§2.3 영업일 2일 이내 1차 회신</i>'
  );

  res.status(200).json({
    ok: true,
    no,
    recordId,
    notified: Boolean(tg && tg.ok),
    message: '문의가 접수되었습니다. 영업일 2일 이내에 회신드립니다.',
  });
};
