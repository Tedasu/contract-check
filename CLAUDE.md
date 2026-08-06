# CLAUDE.md — 프로젝트 가이드

이 파일은 Claude Code가 이 프로젝트에서 작업할 때 자동으로 읽는 지침 파일이다.
프로젝트 루트에 `CLAUDE.md`라는 이름으로 두면 세션 시작 시 자동으로 컨텍스트에 로드된다.

---

## 1. 로컬 연결 (Claude Code 설치·실행)

### 설치

```bash
# npm으로 설치 (Node.js 18+ 필요)
npm install -g @anthropic-ai/claude-code

# 또는 Windows 데스크톱 앱 사용 (Mac/Windows 지원)
# https://claude.ai/download
```

### 실행

```powershell
cd C:\path\to\project   # 프로젝트 폴더로 이동
claude                  # 대화형 세션 시작
```

- 처음 실행하면 브라우저로 Anthropic 계정 로그인(OAuth)을 안내한다.
- `claude "질문"` — 일회성 질문 실행
- `claude -c` — 직전 세션 이어서 계속
- VS Code / JetBrains 확장으로 IDE 안에서도 사용 가능

### 로컬 환경 정보

- OS: Windows 11
- 셸: PowerShell (기본) — Git Bash 등 POSIX 셸이 필요하면 별도 지정
- 작업 디렉토리: 프로젝트 루트 기준으로 실행할 것
- 경로 구분자: 백슬래시(`\`) 사용, 명령 인자에 공백이 있으면 큰따옴표로 감쌀 것

---

## 2. 필수 세팅

### 설정 파일 위치

| 파일 | 용도 |
|------|------|
| `~/.claude/CLAUDE.md` (Windows: `%USERPROFILE%\.claude\CLAUDE.md`) | 전역 지침 (모든 프로젝트 공통) |
| `<프로젝트>/CLAUDE.md` | 프로젝트별 지침 (이 파일) |
| `~/.claude/settings.json` | 전역 설정 (권한, 훅, 환경변수) |
| `<프로젝트>/.claude/settings.json` | 프로젝트 설정 (팀 공유, git 커밋) |
| `<프로젝트>/.claude/settings.local.json` | 개인 설정 (git 제외) |

### 권한(permissions) 예시 — `.claude/settings.json`

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run build)",
      "Bash(npm run dev:*)",
      "Bash(git status)",
      "Bash(git diff:*)"
    ],
    "deny": [
      "Bash(rm -rf:*)",
      "Bash(Remove-Item -Recurse -Force:*)"
    ]
  }
}
```

### 배포 규칙 (중요)

- **배포는 `git push origin main`으로만 한다.**
- Netlify CLI, Vercel CLI 등으로 직접 배포하지 마.
- 배포·서버 구성은 기존 방식 그대로 유지하고 임의로 바꾸지 마.

---

## 3. 하네스(Harness) 기본 내용

하네스란 Claude가 실제로 동작하는 실행 환경(도구, 권한, 컨텍스트 관리)을 말한다.

### Claude가 쓰는 주요 도구

- **Read / Write / Edit** — 파일 읽기·생성·수정
- **Bash / PowerShell** — 셸 명령 실행 (권한 모드에 따라 승인 필요)
- **Glob / Grep** — 파일·코드 검색
- **Agent(서브에이전트)** — 큰 탐색·병렬 작업을 별도 에이전트에 위임
- **WebSearch / WebFetch** — 웹 검색·페이지 가져오기
- **Skill(슬래시 명령)** — `/init`, `/code-review`, `/simplify` 등

### 컨텍스트 로딩 순서

1. `~/.claude/CLAUDE.md` (전역 지침)
2. 프로젝트 루트의 `CLAUDE.md` (이 파일)
3. 메모리 인덱스 (`~/.claude/projects/.../memory/MEMORY.md`)

대화가 길어지면 자동으로 요약(compact)되어 다음 컨텍스트로 이어진다.

### 권한 모드

- 기본: 파일 수정·명령 실행 전 사용자 승인 요청
- `/permissions` 로 허용 목록 관리 (터미널 세션에서)
- 자주 쓰는 안전한 명령은 settings.json의 allow에 등록해 프롬프트 줄이기

### 훅(hooks) — 자동화

특정 이벤트(도구 실행 전/후, 세션 종료 등)에 셸 명령을 자동 실행하려면
settings.json에 hooks를 등록한다. "매번 X 할 때마다 Y 해줘" 같은 자동화는
기억이 아니라 훅으로만 보장된다.

---

## 4. 작업 원칙 (요약)

우선순위: **정확성 > 검증 > 최소 변경 > 명확성 > 유지보수성**

- 파일·API·스키마가 존재한다고 가정하지 말고 먼저 읽어서 확인해.
- 수정 전에 관련 파일을 읽고, 수정 후에는 테스트·실행으로 검증해.
- 요청된 작업에만 변경을 국한하고, 관련 없는 리팩토링은 하지 마.
- 가장 단순한 해결책을 선호하고, 불필요한 의존성·추상화를 추가하지 마.
- 기존 프로젝트의 관례와 스타일을 따라.
- 막히면 멈추고 무엇이 막혔는지, 무엇이 검증됐는지 명확히 보고해.
- 검증 없이 "성공했다"고 주장하지 마.

---

## 5. 프로젝트별 정보

- **프로젝트 이름:** 계약사항 체크 사이트 (계약서 PDF·사진을 올리면 OCR로 조항을 자동 점검)
- **기술 스택:** 순수 HTML/CSS/JS (빌드 도구·프레임워크 없음). 백엔드 없음 — OCR과 판정 모두 브라우저에서 처리.
  - `pdf.js` (CDN, ESM 동적 import) — PDF 텍스트 레이어 추출
  - `Tesseract.js` (CDN) — 이미지·스캔본 한국어 OCR (`kor+eng`, 최초 1회 약 7MB 다운로드)
- **개발 서버 실행:** `powershell -ExecutionPolicy Bypass -File serve.ps1` (포트 5173) 또는 `index.html`을 직접 더블클릭. `serve.ps1`은 .NET `HttpListener` 기반 자체 제작 서버로 Node·Python 등 외부 의존성이 없다.
- **빌드:** 없음 (정적 파일 그대로 배포)
- **테스트:** 자동화 테스트 없음. `file://`로 열면 CDN·워커가 막히므로 반드시 `serve.ps1`로 띄워서 확인할 것. 검증은 브라우저 콘솔에서 `Matcher.analyze(CONTRACT_TYPES[0], '샘플 계약서 텍스트')`를 호출해 판정 결과를 직접 확인하는 방식이 가장 빠르다.
- **배포:** GitHub(`Tedasu/contract-check`) → Vercel 자동 배포. `git push origin main` 하면 그대로 반영된다. 실제 배포 주소는 `https://contract-check-one.vercel.app`.

### 파일 구조

| 파일 | 역할 |
|------|------|
| [js/data.js](js/data.js) | 계약 유형·점검 항목·판정 규칙(`CONTRACT_TYPES`) |
| [js/match.js](js/match.js) | 텍스트 정규화, 조건군 매칭, 편집거리 유사매칭, 근거 문장 추출 |
| [js/extract.js](js/extract.js) | PDF 텍스트 추출 / 이미지 전처리 + OCR |
| [js/app.js](js/app.js) | 화면 전환, 진행률, 결과 렌더링 |
| [js/feedback.js](js/feedback.js) | 익명 문의함 (제출·조회, 비밀번호 해싱) |
| [js/config.js](js/config.js) | Supabase URL / anon key — **직접 채워 넣어야 함** |
| [docs/supabase-setup.sql](docs/supabase-setup.sql) | 문의함 테이블·보안정책·RPC 함수 |
| [about.html](about.html) / [privacy.html](privacy.html) / [terms.html](terms.html) | 소개·개인정보처리방침·이용약관 (AdSense 필수 페이지) |
| [robots.txt](robots.txt) / [sitemap.xml](sitemap.xml) | SEO — 도메인이 바뀌면 둘 다 갱신할 것 |
| [docs/adsense-checklist.md](docs/adsense-checklist.md) | 애드센스 심사 준비 점검 결과와 남은 할 일 |

- **주의사항:**
  - 이 로컬 환경에는 Node.js/npm/Python이 설치되어 있지 않다. Vite 등 빌드 도구가 필요한 제안을 하기 전에 설치 여부를 먼저 확인할 것.
  - **계약서 원문을 `localStorage`나 서버에 저장하지 말 것.** 민감 문서이므로 메모리에만 두는 것이 의도된 설계다. `localStorage`에는 화면 테마만 저장한다.
  - 점검 항목 추가·수정은 `data.js`의 `CONTRACT_TYPES`만 건드리면 된다. 규칙 문법은 파일 상단 주석 참고.
  - **계약서 본문으로 판단할 수 없는 항목은 `manualOnly: true`로 둘 것.** (예: 등기부등본 확인) 넘겨짚어 자동 판정하면 정확도가 떨어지고 사용자를 오도한다.
  - 판정 결과에는 항상 **근거 문장**을 함께 보여준다. 사람이 눈으로 검증할 수 있어야 하므로 이 구조를 유지할 것.
  - **문의함은 익명 수집이 원칙이다.** 이메일·IP·User-Agent 등 신원을 특정할 수 있는 값을 절대 추가하지 말 것.
  - 문의 비밀번호는 브라우저에서 SHA-256 해시 후 전송하고, 서버에서 bcrypt로 저장한다. 평문을 서버로 보내거나 저장하는 방향으로 바꾸지 말 것.
  - `feedback` 테이블은 RLS를 켜고 정책을 두지 않아 직접 접근이 막혀 있다. 읽기·쓰기는 `submit_feedback` / `get_feedback` 함수로만 한다. select 정책을 열면 남의 문의가 전부 노출되므로 열지 말 것.
  - `config.js`의 anon key는 공개용이라 커밋해도 된다. **service_role 키는 절대 프론트엔드에 넣지 말 것.**
  - 사이트는 법률 자문이 아니라는 면책 문구가 상단에 고정되어 있다 — 문구 삭제 금지.
  - 백엔드가 필요해지는 시점과 확장 방법은 [docs/backend-setup.md](docs/backend-setup.md)에 정리되어 있다.
  - **홈 화면의 "미리 보기" 섹션(`renderPreview()` in js/app.js)은 업로드 없이도 실제 콘텐츠를 보여주기 위한 것이다.** 검색엔진과 애드센스 심사가 첫 화면에서 실질적인 내용을 보게 하려는 의도적 설계이므로, 지우거나 업로드 후에만 보이게 바꾸지 말 것.
  - `index.html`/`about.html`/`privacy.html`/`terms.html`은 페이지당 `<h1>`이 정확히 하나여야 한다. 헤더의 브랜드명은 `<p class="brand-title">`이지 `<h1>`이 아니다 — 새 페이지를 추가할 때 이 패턴을 유지할 것.
  - `ads.txt`는 아직 만들지 않았다. 애드센스 게시자 ID를 실제로 받기 전까지는 만들지 말 것 — 가짜 값은 심사에 불리하다. 자세한 내용은 [docs/adsense-checklist.md](docs/adsense-checklist.md).
  - 도메인이 바뀌면 `robots.txt`, `sitemap.xml`, 4개 HTML 파일의 `canonical`·OG URL에 박혀 있는 `contract-check-one.vercel.app`을 전부 새 도메인으로 바꿔야 한다.
