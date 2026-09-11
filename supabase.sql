-- ============================================================
-- Salvation — 나의 성소 데이터베이스
-- Supabase ▸ SQL Editor 에 그대로 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전합니다 (if not exists / drop policy if exists).
--
-- 이 표가 없어도 사이트는 정상 동작합니다.
-- 다만 묵상·기도 기록이 그 기기에만 남고 다른 기기와 공유되지 않습니다.
-- ============================================================

-- ── 1. 묵상 노트 ────────────────────────────────────────────
create table if not exists public.qt_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  uid        text not null,                 -- 브라우저가 만든 식별자. 로컬 ↔ 클라우드 병합 기준
  date       date not null,
  ref        text,                          -- 구절 출처
  verse      text,                          -- 구절 본문
  saw        text,                          -- ① 무엇을 보았는가
  felt       text,                          -- ② 무엇을 느꼈는가
  act        text,                          -- ③ 무엇을 하겠는가
  created_at timestamptz not null default now(),
  unique (user_id, uid)
);
create index if not exists qt_notes_user_date_idx on public.qt_notes (user_id, date desc);

-- ── 2. 기도 제목 ────────────────────────────────────────────
create table if not exists public.prayers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  uid         text not null,
  title       text not null,
  cat         text,                         -- 감사 | 간구 | 중보 | 회개
  started     date not null,
  answered_at date,                         -- 응답받은 날. null 이면 진행 중
  created_at  timestamptz not null default now(),
  unique (user_id, uid)
);
create index if not exists prayers_user_idx on public.prayers (user_id, answered_at, created_at desc);

-- ── 3. 통독 진도 · 연속 묵상 · 암송 횟수 (사용자당 한 행) ────
create table if not exists public.user_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  reading    jsonb not null default '[]'::jsonb,   -- 읽은 성경 66권 이름 배열
  practice   jsonb not null default '[]'::jsonb,   -- 묵상한 날짜 'YYYY-MM-DD' 배열
  memory     jsonb not null default '{}'::jsonb,   -- { "구절 출처": 암송횟수 }
  updated_at timestamptz not null default now()
);

-- ── 4. 행 수준 보안 (본인 것만 읽고 쓴다) ───────────────────
alter table public.qt_notes   enable row level security;
alter table public.prayers    enable row level security;
alter table public.user_state enable row level security;

drop policy if exists "qt_notes owner"   on public.qt_notes;
drop policy if exists "prayers owner"    on public.prayers;
drop policy if exists "user_state owner" on public.user_state;

create policy "qt_notes owner" on public.qt_notes
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "prayers owner" on public.prayers
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_state owner" on public.user_state
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 5. (참고) 이미 쓰고 있는 말씀 서재 표 ───────────────────
-- saved_verses 표가 아직 없다면 아래도 함께 실행하세요.
create table if not exists public.saved_verses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null default 'scripture',   -- scripture | wisdom
  ref        text not null,
  verse      text not null,
  domain     text,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists saved_verses_user_idx on public.saved_verses (user_id, created_at desc);

alter table public.saved_verses enable row level security;
drop policy if exists "saved_verses owner" on public.saved_verses;
create policy "saved_verses owner" on public.saved_verses
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 인증 설정 (Supabase 대시보드에서 확인)
--   Authentication ▸ URL Configuration
--     Site URL         : https://<배포 도메인>
--     Redirect URLs    : https://<배포 도메인>/  (메일 로그인·비밀번호 재설정 복귀 주소)
--   Authentication ▸ Providers ▸ Email
--     Enable Email provider, Confirm email 권장
-- ============================================================
