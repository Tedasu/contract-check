# 🛠 백엔드 구성 설명서 — 계약사항 체크 사이트

> 프론트엔드를 먼저 완성한 뒤, 서버·DB·배포가 필요할 때 위에서부터 순서대로 따라온다.
>
> **현재 상태:** 이 사이트는 백엔드가 필요한 기능이 없어 정적 프론트엔드만으로 동작한다.
> 체크 상태는 브라우저 localStorage에 저장되며 서버 통신이 없다.
> 아래 내용은 나중에 계정·동기화·결제 등이 필요해질 때 참고할 계획이다.

## 0. 전체 흐름 한눈에

① 프론트엔드 완성 → ② 백엔드 서비스 선택 → ③ DB·인증 연결 → ④ 환경변수 설정 → ⑤ 배포 → ⑥ 도메인·HTTPS 연결

## 1. 백엔드 무엇으로 할까? (선택)

- **가장 쉬움 — Supabase / Firebase**: DB + 인증 + 파일저장이 한 번에. 서버 코드 거의 없이 프론트에서 SDK로 호출. 개인·소규모에 강력 추천.
- **직접 서버 — Node(Express) 또는 Next.js API Routes**: 복잡한 로직·외부 결제 연동이 필요할 때.
- 결제·외부 API 키가 있으면 키를 숨기기 위해 최소한의 서버(또는 서버리스 함수)가 반드시 필요하다(프론트에 시크릿 키 노출 금지).

## 2. 서버 연동 기본 (프론트 ↔ 백엔드)

1. 백엔드 주소를 환경변수로 둔다 — 예: `VITE_API_URL=https://api.내서비스.com`
2. 프론트에서 호출 — `fetch(import.meta.env.VITE_API_URL + '/posts')`
3. CORS 허용 — 백엔드에서 프론트 도메인을 허용 목록에 추가
4. 인증 토큰은 `Authorization: Bearer <token>` 헤더로 전달, 민감정보는 절대 URL/프론트 코드에 노출 금지

## 3. 데이터베이스

- **관계형(PostgreSQL/MySQL)**: 관계·정형 데이터가 많을 때 (Supabase = PostgreSQL)
- **문서형(Firestore/MongoDB)**: 빠른 시작·유연한 스키마
- 순서: 테이블/컬렉션 설계 → CRUD API 만들기 → 프론트 연결

## 4. 환경변수 / 비밀키 관리

- `.env` 파일에 키 저장하고 `.gitignore`에 추가 (절대 깃에 커밋 금지)
- 배포 플랫폼(Vercel/Netlify/Render)의 Environment Variables에 동일하게 등록
- 공개 가능한 값만 접두사 규칙으로 노출 (Vite=`VITE_`, Next=`NEXT_PUBLIC_`), 시크릿 키는 서버에서만 사용

## 5. 배포 방법 (가장 쉬운 경로)

### 프론트엔드

1. GitHub에 코드 push
2. Vercel 또는 Netlify에서 레포 연결 → 자동 빌드·배포 (무료)
3. 빌드 설정 확인
   - **현재 이 프로젝트**: 빌드 도구 없음. 빌드 명령 비워두고 배포 디렉토리를 루트(`.`)로 지정
   - 나중에 Vite로 옮기면: 빌드 명령 `npm run build`, 출력 폴더 `dist`

### 백엔드

- Supabase/Firebase를 쓰면 콘솔에서 프로젝트 생성만 하면 끝 (별도 배포 불필요)
- 직접 서버라면 Render / Railway / Fly.io에 배포하거나 Vercel 서버리스 함수 사용

## 6. 도메인 · HTTPS

- 배포하면 기본 도메인이 자동 제공됨 (예: `프로젝트명.vercel.app`)
- 커스텀 도메인은 도메인 구매 후 DNS의 CNAME/A 레코드를 배포 플랫폼에 연결
- Vercel/Netlify는 HTTPS(SSL)를 자동 적용

## 내가 추가한 재료별 백엔드

### 익명 문의함 — Supabase 필요 ✅

계약서 점검 기능은 백엔드가 필요 없지만, **문의함은 백엔드가 반드시 필요하다.**
브라우저에만 저장하면 작성자 본인만 볼 수 있고 운영자에게는 전달되지 않기 때문이다.

**설정 순서**

1. [supabase.com](https://supabase.com)에서 프로젝트 생성 (무료)
2. SQL Editor → New query → [`supabase-setup.sql`](supabase-setup.sql) 전체 붙여넣고 Run
3. Project Settings → API 에서 **Project URL**과 **anon public key** 복사
4. `js/config.js`에 두 값 입력

**구조**

| 항목 | 내용 |
|---|---|
| 테이블 | `public.feedback` |
| 접근 제어 | RLS 활성화 + 정책 없음 → 테이블 직접 접근 전면 차단 |
| 쓰기 | `submit_feedback(category, body, password_hash)` → 문의번호 반환 |
| 읽기 | `get_feedback(ticket, password_hash)` → 문의번호+비밀번호 일치 시 1건 |
| 비밀번호 | 브라우저 SHA-256 → 서버 bcrypt 저장 (평문은 기기 밖으로 안 나감) |
| 수집 정보 | 문의 내용과 분류만. 이메일·IP·기기 정보 없음 |

**문의 확인 방법** — Supabase 대시보드 SQL Editor에서:

```sql
select id, ticket_code, category, status, created_at, body
from public.feedback order by created_at desc;
```

**답변 달기** — 답변을 넣으면 작성자가 문의번호+비밀번호로 조회할 때 보인다:

```sql
update public.feedback
set reply = '확인 후 반영했습니다. 감사합니다.', status = 'done', replied_at = now()
where ticket_code = 'ABCD2345';
```

**남은 한계** — 스팸 방지 장치가 없다. 장난 글이 쌓이면 Edge Function으로 요청 제한이나 캡차를 앞단에 두는 것을 검토할 것.

## 진행 순서 체크리스트

- [x] 프론트엔드 완성
- [ ] 프론트엔드 배포
- [x] 백엔드 서비스 선택 (Supabase)
- [ ] **Supabase 프로젝트 생성 + `supabase-setup.sql` 실행**
- [ ] **`js/config.js`에 URL·anon key 입력**
- [ ] 로그인·인증 연결 — *현재 불필요 (문의함은 익명이라 로그인 없음)*
- [ ] 커스텀 도메인 · HTTPS 연결

## 나중에 백엔드가 더 필요해지는 시점

| 원하는 기능 | 필요한 것 |
|---|---|
| 기기 간 점검 결과 동기화 | 로그인(Auth) + DB 테이블 |
| 계약서 파일 보관 | Storage — 단, 민감 문서라 신중히 결정할 것 |
| 문의 스팸 차단 | Edge Function (rate limit / 캡차) |
| 유료 기능 | 결제 연동 + 서버(시크릿 키 보호) |
