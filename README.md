# Salvation

성경의 말씀과 인문학·철학의 지혜로 삶의 근본을 비추는 서재.
설계 · 개발: **김유빈 (Yubin Kim)** · © 2026 Yubin Kim
개인 창작 프로젝트이며, 특정 교회·기관의 공식 서비스가 아닙니다.

정적 사이트(단일 index.html + PWA). 서버·빌드 불필요.

---

## GitHub에 올리고 Vercel로 배포하기

### 1) GitHub 저장소 만들기
- 방법 A (웹): github.com → New repository → 이름 `salvation` (Public) → Create.
- 방법 B (gh CLI 설치·로그인 돼 있으면): 아래 4)에서 한 줄로 생성까지 됩니다.

### 2) 이 폴더에서 git 시작
```bash
cd salvation
git init
git add .
git commit -m "Salvation 최초 배포"
git branch -M main
```

### 3) 원격 연결 후 push (웹에서 repo 만든 경우)
```bash
git remote add origin https://github.com/<본인아이디>/salvation.git
git push -u origin main
```

### 4) gh CLI로 한 번에 (설치·로그인 돼 있으면)
```bash
gh repo create salvation --public --source=. --remote=origin --push
```

### 5) Vercel 연결 (자동 배포)
- vercel.com → Add New ▸ Project → 위 저장소 Import → Framework: **Other** → Deploy.
- 이후 `git push` 할 때마다 자동 재배포.
- 신규 프로젝트는 **Vercel Authentication(로그인 벽)** 이 기본 ON일 수 있으니,
  Settings ▸ Deployment Protection ▸ Vercel Authentication → **Disabled** 로 공개.
- 커스텀 도메인: Settings ▸ Domains.

### 아이폰
- 배포 주소를 Safari로 열고 `공유 ▸ 홈 화면에 추가` → 전체화면 PWA.
