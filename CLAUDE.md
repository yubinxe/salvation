# CLAUDE.md — Salvation (말씀 구원)

## 세션 시작 시 할 일
1. `docs/WORKLOG.md` 를 먼저 읽고 `## 진행 중` 항목부터 이어간다.
2. `git status`, `git log --oneline -5`, `gh pr list` 로 현재 브랜치·열린 PR을 확인한다.
3. 작업을 마치면 `docs/WORKLOG.md` 를 갱신해 같은 PR에 포함한다.

## 프로젝트 개요
- 성경의 말씀과 인문학·철학의 지혜로 삶의 근본을 비추는 서재. 단일 `index.html` PWA (README 기준).
- 배포 URL: https://malsseum-guwon.vercel.app/
- 기능: 말씀 저장, 로그인/회원가입(Supabase), 나의 성소(묵상 노트·기도 제목·말씀 암송·통독 진도·연속 묵상), 상담 챗봇·상담·문의 폼(CRM), 마스코트 등불이(인라인 SVG).
- 설계·개발 김유빈. 개인 창작 프로젝트이며 특정 교회·기관의 공식 서비스가 아님.

## 기술 스택
- 정적 사이트 + PWA(`manifest.webmanifest`, `sw.js`). 빌드 도구·`package.json` 없음.
- 서버리스: Vercel Functions(`api/`) → Airtable `고객관리` 베이스 기록 + 텔레그램 알림.
- 인증·동기화: Supabase (`supabase.sql` 수동 실행, 미실행 시 기기 로컬 저장으로 동작).
- 웹폰트: Hahmlet(`--fs`, 세리프), Noto Sans KR(`--fu`, 본문 UI).

## 구조
| 경로 | 역할 |
|---|---|
| `index.html` | 화면·스타일·클라이언트 스크립트 전체(약 240KB) |
| `api/_crm.js` | Airtable·Telegram 공용 모듈, 위기 신호 판정, 일련번호 채번 |
| `api/lead.js` / `api/risk.js` / `api/health.js` | 문의 접수(POST) / 위기 신호 기록(POST) / 환경변수·연결 점검(GET) |
| `sw.js` | 서비스워커. 문서는 네트워크 우선, `/api/`·`version.json` 은 가로채지 않음 |
| `version.json` + `<meta name="salv-build">` | 캐시 무효화 장치. 두 값이 다르면 SW·캐시 삭제 후 1회 새로고침 |
| `vercel.json` | 보안 헤더·캐시 헤더 |
| `.vercelignore` | `*.md`·`supabase.sql`·`.env*` 등을 배포본에서 제외 |
| `supabase.sql` | 나의 성소 테이블·정책 (여러 번 실행해도 안전) |
| `README.md`, `DEPLOY.md`, `CRM-SETUP.md` | 개요, 배포 순서, CRM 토큰·운영 |
| `.env.example` | 서버 환경변수 이름 예시(값 없음) |

## 명령
- 설치·빌드·테스트 스크립트 없음.
- 정적 화면 확인: 루트에서 정적 서버 실행(예: `npx serve .`). `api/` 는 Vercel 환경변수가 있어야 동작.
- 최소 점검: `node --check api/*.js`, `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"`.
- 배포 후 점검: `/api/health` (DEPLOY.md ⑤).

## 작업 규칙
- 모든 변경은 브랜치 → PR. `main` 직접 push 금지.
- `main` 병합·운영 배포는 사용자 승인 후에만.
- API 키·`.env`·`.env.local`·개인정보 커밋 금지. 저장소는 공개. 토큰은 Vercel 환경변수에만 둔다.
- 상담·위기 신호(RiskEvents) 데이터는 민감정보. 실제 기록을 코드·문서·로그에 옮기지 않는다.
- 지어낸 수치·실적 금지. 성경 구절·인용은 출처를 확인해 반영.
- 사용자 보고는 한국어 간결.

## 디자인 기준 (index.html CSS 변수, 라이트/다크)
- 와인 `--wine:#7C2E3C`(다크 `#C55E6D`), 금색 `--gold:#A9843E`(다크 `#CBA85F`)
- 바탕 `--ground:#F4F1EA`(다크 `#1A1214`), 면 `--surface:#FCFBF7`(다크 `#241A1D`)
- 글자 `--ink:#2A211E`(다크 `#EEE5DD`), 히어로 버건디 `--hero-1`·`--hero-2`
- 서체: 제목 Hahmlet, 본문 Noto Sans KR. 작은 글자는 피한다(커밋 08e71ac·69b6afa).
- 마스코트 이름은 마스코트 스크립트의 `var NAME` 한 줄로 관리.

## 테스트·배포 정책
- 자동 테스트 없음. 변경 후 데스크톱(>=1000px)·모바일 실제 렌더와 콘솔 오류를 확인해 PR에 기록.
- 화면을 바꿔 배포할 때는 `version.json` 의 `build` 와 `index.html` 의 `salv-build` 를 같은 새 값으로 올리고, 필요하면 `sw.js` 의 `CACHE` 버전을 올린다.
- 배포는 Vercel(DEPLOY.md: `git push` 시 자동 재배포). 따라서 `main` 병합 = 운영 배포이므로 반드시 사용자 승인 후.
- 환경변수 변경은 Redeploy 해야 반영(DEPLOY.md ④).
