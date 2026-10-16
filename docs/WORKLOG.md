# WORKLOG — salvation

## 현재 상태
- 기준일: 2026-10-16
- 기본 브랜치: `main` (최신 `9ea8a24`, 2026-10-11)
- 작업 브랜치: `chore/cloud-continuity` (클라우드 작업 연속성 문서·훅 추가)
- 최근 커밋
  - `9ea8a24` 제작자 표기 — 김유빈 포트폴리오 연결 (#1)
  - `59f8055` 히어로 하단 공백 제거 · 붉은 장막 재배분 · 헤더를 버건디에 맞춤
  - `bb99c67` 랜딩 재구성 — 배경 사진 · 스크롤 흐름 · 점진적 공개
- 현재 빌드 표기: `version.json` `20261009-2300`, `sw.js` 캐시 `salvation-v7`

## 완료
- 제작자 표기: author 메타·creator 구조화 데이터·화면 크레딧 (#1)
- 랜딩: 배경 사진·스크롤 흐름·점진적 공개, 히어로 공백·버건디 헤더 정리
- 가독성: 글자 크기 상향, 폼 통일, 정보 위계, 히어로 줄바꿈 수정
- 보안: 배포본에서 비밀값·로컬 설정 업로드 차단(`.vercelignore`)
- PC 레이아웃 2열 정리, `version.json` 기반 캐시 무효화 장치
- CRM 연동(Airtable·텔레그램), 나의 성소, 마스코트 등불이, 배포 준비
- 말씀 저장, 로그인/회원가입(Supabase), PC 밀도 최적화
- 최초 배포(성경 말씀 + 인문학 서재)

## 진행 중
- `chore/cloud-continuity`: CLAUDE.md · docs/WORKLOG.md · `.claude/settings.json` SessionStart 훅 · `.gitignore` 보강 (PR 검토 대기)
- 그 밖의 진행 중 작업: 확인 필요

## 미해결 문제
- PC 로컬 클론이 삭제된 브랜치(`credit/maker-attribution`)에 있음 → `git switch main && git pull`
- DEPLOY.md ⑦ Airtable 수동 작업(RiskEvents 열람 잠금 등) 완료 여부: 확인 필요
- Supabase `supabase.sql` 실행·URL Configuration 반영 여부: 확인 필요
- DEPLOY.md 문제 표에 서비스워커 `salvation-v5` 로 적혀 있으나 현재 `sw.js` 는 `salvation-v7` (문서 갱신 필요 여부 확인)
- `.vercelignore` 가 `.claude/` 를 제외하지 않아 `.claude/settings.json` 이 배포본에 포함될 수 있음(비밀값 없음)

## 열린 PR
- 이 PR(`chore/cloud-continuity`) 외 열린 PR 없음 (2026-10-16 `gh pr list` 기준)

## 다음 행동
1. 이 PR 검토 후 사용자 승인 시 병합
2. PC 로컬 클론을 `main` 으로 전환
3. 미해결의 Airtable·Supabase 설정 상태 확인
4. 다음 기능 작업: 확인 필요

## 검증 기록
- 2026-10-16: 빌드·테스트 스크립트 없음. `node --check` 통과(`api/_crm.js`·`health.js`·`lead.js`·`risk.js`·`sw.js`). `vercel.json`·`manifest.webmanifest`·`.claude/settings.json` JSON 파싱 통과. SessionStart 훅 실행 시 WORKLOG 출력·종료코드 0. 브라우저 렌더·`/api/health` 점검은 이번 변경(문서·설정만) 범위 밖이라 미실시.
