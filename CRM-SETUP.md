# Salvation CRM 연동 — 설치와 운영

홈페이지의 **상담 챗봇**과 **상담·문의 폼**이 Airtable 베이스 `고객관리`(`appHlpNTeCXrHKArz`)에 기록되고,
접수 즉시 **텔레그램**으로 알림이 갑니다. 설계 근거는 `../crm-schema.md`.

---

## 1. 구조

```
[방문자]
   │  상담하기 버튼(챗봇)  ·  상담·문의 폼
   ▼
index.html  ── fetch ──▶  /api/lead   ──▶  Airtable · Leads      ──▶  Telegram 알림
                          /api/risk   ──▶  Airtable · RiskEvents ──▶  Telegram 긴급
                          /api/health      연동 점검
```

| 파일 | 역할 |
|---|---|
| `api/_crm.js` | Airtable·Telegram 공용 모듈, 위기 신호 판정, 일련번호 채번 |
| `api/lead.js` | 문의 접수 (`POST`) |
| `api/risk.js` | 위기 신호 기록 (`POST`) |
| `api/health.js` | 환경변수·연결 점검 (`GET`) |

**토큰은 index.html에 없습니다.** 정적 파일은 누구나 열어볼 수 있으므로 모든 비밀값은
서버 환경변수로만 두고, 브라우저는 `/api/*`만 호출합니다.

---

## 2. 토큰 발급

### Airtable 개인 액세스 토큰
1. https://airtable.com/create/tokens → **Create new token**
2. Scopes: `data.records:read`, `data.records:write`
3. Access: 베이스 **고객관리** 선택
4. `pat...` 로 시작하는 값을 복사 (재확인 불가, 이때 저장할 것)

### 텔레그램 봇
1. 텔레그램에서 **@BotFather** → `/newbot` → 이름·아이디 입력 → `123456789:AA...` 토큰 수령
2. 만든 봇과 대화를 **먼저 시작**(`/start`)해야 봇이 메시지를 보낼 수 있습니다.
3. Chat ID 확인 — 브라우저에서
   `https://api.telegram.org/bot<봇토큰>/getUpdates`
   → `"chat":{"id":123456789 ...}` 의 숫자가 `TELEGRAM_CHAT_ID`
   (그룹에 넣었다면 `-100...` 처럼 음수입니다. 그룹에서는 봇을 관리자로 두거나 privacy mode를 끄세요.)

---

## 3. Vercel 설정

Vercel ▸ 프로젝트 ▸ **Settings ▸ Environment Variables** 에 아래를 추가합니다
(Production / Preview / Development 모두 체크).

| Key | Value |
|---|---|
| `AIRTABLE_TOKEN` | `pat...` |
| `AIRTABLE_BASE_ID` | `appHlpNTeCXrHKArz` |
| `TELEGRAM_BOT_TOKEN` | `123456789:AA...` |
| `TELEGRAM_CHAT_ID` | 위에서 확인한 숫자 |
| `ADMIN_KEY` | (선택) 아무 문자열. `/api/health?deep=1` 보호용 |

저장한 뒤 **Redeploy** 해야 값이 함수에 반영됩니다.

### 점검
```
https://<도메인>/api/health
```
환경변수 설정 여부만 보여줍니다(값은 노출되지 않음).

```
https://<도메인>/api/health?deep=1&key=<ADMIN_KEY>
```
Airtable 읽기 1회와 텔레그램 `getMe`를 실제로 시도합니다. `"ok": true` 면 연동 완료.

---

## 4. 로컬에서 돌려 보기

```bash
npm i -g vercel
cd salvation
cp .env.example .env.local   # 값 채우기
vercel dev
```
`.env.local` 은 `.gitignore` 에 있어 커밋되지 않습니다.

---

## 5. 기록되는 내용

### 정상 접수 → `Leads`
| 필드 | 값 |
|---|---|
| 문의번호 | `L-2026-0001` 형식으로 자동 채번 (연도별로 리셋) |
| 유입경로 | 챗봇은 `상담챗봇`, 폼은 `웹 문의폼` |
| 문의구분 | 7종 중 선택 |
| 진입 상태칩 | 10종 중 복수 선택 (`company-profile.md` §7.1①) |
| 상태 / 담당자 | `신규` / `미배정` 고정 |
| 비고 | 접수 시각(KST), 개인정보 동의 사실, 유입 화면, 기기 정보 |

선택지는 서버에서 베이스 스키마와 대조해 걸러냅니다. 베이스에 없는 값이 들어와
레코드 생성이 통째로 실패하는 일이 없습니다.

### 위기 신호 → `RiskEvents` (`service-policy.md` §14)
`자살·자해`, `타인 가해`, `학대 피해` 키워드가 감지되면

1. 상담 흐름을 **즉시 중단**하고 (§14.2①)
2. 24시간 전문기관 안내를 화면에 띄우고 (§14.2②)
3. `RiskEvents`에 감지 사실만 기록합니다 — **입력 원문은 저장하지 않습니다** (§8.2 민감정보 동의 없는 익명 유입)
4. 텔레그램으로 무음 해제 긴급 알림이 갑니다. 알림에도 원문은 담기지 않습니다.

이때 `Leads`에는 아무것도 남지 않습니다. 판매 파이프라인에 위기 건을 섞지 않기 위함입니다.

> ⚠️ `RiskEvents` 표는 Airtable 권한에서 **대표 전용 열람**으로 잠가야 합니다 (`service-policy.md` §9.1).
> 자동 기록이므로 실제 위기 여부는 대표가 확인해야 합니다.

---

## 6. 장애 시 동작

| 상황 | 동작 |
|---|---|
| Airtable 기록 실패 | 502 응답 + **문의 원문 전체를 텔레그램으로 백업 전송**. 문의가 사라지지 않습니다. |
| 텔레그램 실패 | 접수는 성공 처리. 응답의 `notified: false` 로만 표시됩니다. |
| 채번 조회 실패 | 타임스탬프 기반 번호로 폴백하고 접수를 계속합니다. |
| 위기 기록 실패 | 화면 안내는 그대로 나가고, 실패 사실이 텔레그램으로 갑니다. |
| 같은 IP 분당 6회 초과 | 429. 봇용 허니팟(`website` 숨김 필드)도 함께 걸러냅니다. |

---

## 7. 다른 호스팅에 올린 경우

GitHub Pages 등 Vercel이 아닌 곳에 `index.html`을 올렸다면 함수가 없으므로
페이지 상단(또는 `index.html`의 CRM 스크립트 첫머리)에 Vercel 주소를 지정합니다.

```html
<script>window.SALV_API_BASE = "https://salvation.vercel.app";</script>
```

`api/_crm.js`의 CORS 허용 목록은 `*.vercel.app`, `*.github.io`, `localhost`를 기본 허용하며,
그 밖의 도메인은 `ALLOWED_ORIGINS` 환경변수에 쉼표로 나열합니다.

---

## 8. Airtable UI에서 직접 해야 하는 것

REST API로는 되지 않아 `crm-schema.md` §4에 미완료로 남아 있는 항목입니다.

- `Leads` 뷰 2종 — `신규만`(상태 = 신규), `오늘 접수`(오늘 접수 = 오늘), 접수일시 내림차순
- `Leads.상태` 기본값 `신규`, `Leads.담당자` 기본값 `미배정`
  (서버가 항상 명시해 넣으므로 웹 유입에는 영향 없음. 수기 입력용)
- **`RiskEvents` 대표 전용 열람 권한** — 반드시 설정
