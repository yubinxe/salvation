# Salvation 배포 순서

처음부터 끝까지 한 번에 따라가면 되는 순서입니다. 소요 20~30분.

```
① GitHub push  →  ② Vercel Import  →  ③ 환경변수 4개  →  ④ Redeploy
                                              ↓
⑧ 도메인 연결  ←  ⑦ Airtable 권한  ←  ⑥ Supabase SQL  ←  ⑤ /api/health 점검
```

---

## ① GitHub에 올리기

```bash
git push origin main
```

`origin` 은 이미 `https://github.com/yubinxe/salvation.git` 으로 잡혀 있습니다.

> **저장소가 공개라는 점을 기억하세요.** 토큰은 코드 어디에도 없고 전부 환경변수로만 읽습니다.
> 앞으로도 `.env.local` 외의 파일에 토큰을 적지 마세요 (`.gitignore` 에 이미 들어 있습니다).

## ② Vercel 프로젝트 연결

1. [vercel.com](https://vercel.com) → **Add New ▸ Project**
2. `yubinxe/salvation` 저장소 Import
3. Framework Preset **Other**, Build Command·Output Directory **비워 둠**
4. **Deploy**

빌드 도구가 없는 정적 사이트라 `package.json` 이 없습니다. Vercel이 `api/` 폴더를
자동으로 서버리스 함수로 인식합니다 — 따로 설정할 것이 없습니다.

처음 만든 프로젝트는 **Vercel Authentication(로그인 벽)** 이 켜져 있을 수 있습니다.
Settings ▸ Deployment Protection ▸ Vercel Authentication → **Disabled** 로 공개하세요.

## ③ 환경변수 넣기

Settings ▸ **Environment Variables** — Production / Preview / Development 모두 체크.

| Key | Value | 발급처 |
|---|---|---|
| `AIRTABLE_TOKEN` | `pat...` | [airtable.com/create/tokens](https://airtable.com/create/tokens) · scope `data.records:read`, `data.records:write` · 베이스 **고객관리** |
| `AIRTABLE_BASE_ID` | `appHlpNTeCXrHKArz` | 고정 |
| `TELEGRAM_BOT_TOKEN` | `123456789:AA...` | 텔레그램 **@BotFather** → `/newbot` |
| `TELEGRAM_CHAT_ID` | 숫자 | 봇과 `/start` 한 뒤 `https://api.telegram.org/bot<토큰>/getUpdates` 에서 `"chat":{"id":...}` |
| `ADMIN_KEY` | (선택) 아무 문자열 | `/api/health?deep=1` 보호용 |

자세한 발급 절차는 [CRM-SETUP.md](CRM-SETUP.md) §2 를 보세요.

## ④ Redeploy

환경변수는 **저장만으로 반영되지 않습니다.** Deployments ▸ 최신 배포 ▸ ⋯ ▸ **Redeploy**.

## ⑤ 연결 점검

```
https://<도메인>/api/health
```
환경변수 설정 여부만 보여줍니다. 값은 절대 나오지 않습니다.

```
https://<도메인>/api/health?deep=1&key=<ADMIN_KEY>
```
Airtable을 실제로 한 번 읽고 텔레그램 `getMe` 를 호출합니다. `"ok": true` 면 완료.

그다음 **사이트에서 문의를 1건 직접 넣어 보세요.**

- 화면에 `문의번호 L-2026-0001` 이 뜨는가
- 텔레그램에 알림이 오는가
- Airtable `Leads` 에 레코드가 생겼는가

확인했으면 그 테스트 레코드는 지우면 됩니다.

## ⑥ Supabase (로그인 · 나의 성소 동기화)

1. Supabase ▸ **SQL Editor** → [supabase.sql](supabase.sql) 전체 붙여넣고 **Run**
   (여러 번 실행해도 안전합니다)
2. Authentication ▸ **URL Configuration**
   - Site URL: `https://<도메인>`
   - Redirect URLs: `https://<도메인>/`
   → 이 값이 비어 있으면 **메일 로그인·비밀번호 재설정 링크가 돌아오지 못합니다.**
3. Authentication ▸ Providers ▸ Email 활성화

> SQL을 실행하지 않아도 사이트는 정상 동작합니다. 다만 묵상·기도 기록이
> 그 기기에만 남고 다른 기기와 공유되지 않습니다.

## ⑦ Airtable에서 직접 해야 하는 것

REST API로는 되지 않아 UI에서 해야 합니다.

- [ ] **`RiskEvents` 표를 대표 전용 열람으로 잠그기** — 자살·자해·학대 기록이 들어갑니다 (`service-policy.md` §9.1). **반드시 하세요.**
- [ ] `Leads` 뷰 2종 — `신규만`(상태 = 신규), `오늘 접수`(오늘 접수 = 오늘), 접수일시 내림차순
- [ ] `Leads.상태` 기본값 `신규`, `Leads.담당자` 기본값 `미배정` (웹 유입은 서버가 항상 채우므로 수기 입력용)

## ⑧ 커스텀 도메인을 붙인 뒤

1. Vercel ▸ Settings ▸ **Domains** 에서 도메인 연결
2. `index.html` 의 아래 세 줄을 절대 주소로 바꾸면 카카오·페이스북 공유 미리보기가 더 확실해집니다
   ```html
   <meta property="og:url"   content="https://내도메인/">
   <meta property="og:image" content="https://내도메인/og.jpg">
   <link  rel="canonical"    href="https://내도메인/">
   ```
   (상대 경로여도 대부분의 스크래퍼는 올바로 풀어 읽습니다. 안 해도 동작합니다.)
3. Supabase URL Configuration 을 새 도메인으로 갱신
4. 카카오톡·X 에 링크를 한 번 붙여 넣어 미리보기 확인

---

## 배포 후 자주 겪는 문제

| 증상 | 원인 | 조치 |
|---|---|---|
| 문의가 "접수 처리 중 문제가 발생했습니다" | 환경변수 미설정 또는 Redeploy 안 함 | ③④ 다시 · `/api/health` 확인 |
| Airtable에는 남는데 텔레그램이 안 옴 | 봇과 대화를 시작하지 않음 | 봇에게 `/start` 를 먼저 보내세요 |
| 텔레그램 그룹에 안 옴 | 그룹 privacy mode | 봇을 그룹 관리자로 올리거나 privacy mode 끄기 |
| 로그인 메일 링크가 엉뚱한 곳으로 감 | Supabase Site URL 미설정 | ⑥-2 |
| 화면이 예전 그대로 | 서비스워커 캐시 | 이미 `salvation-v5` 로 올려 뒀습니다. 그래도 남으면 새로고침 2회 |
| `/api/...` 가 404 | Root Directory 설정이 잘못됨 | Vercel Settings ▸ General ▸ Root Directory 를 비워 두기 |
| 사이트에 로그인 벽이 뜸 | Deployment Protection | ② 마지막 문단 |

## 배포본에 들어가지 않는 것

`.vercelignore` 로 제외됩니다 — 저장소에는 그대로 남습니다.

```
*.md          문서
supabase.sql  마이그레이션
.env.example  환경변수 예시
```
