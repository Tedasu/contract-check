-- ============================================================
-- 계약사항 체크 — 익명 문의함 DB 설정
--
-- 사용법
--   1) https://supabase.com 에서 프로젝트 생성
--   2) 좌측 메뉴 SQL Editor → New query → 이 파일 전체를 붙여넣고 Run
--   3) Project Settings → API 에서 아래 두 값을 복사해 js/config.js 에 입력
--        - Project URL
--        - anon public key  (공개되어도 안전한 키다. service_role 키는 절대 쓰지 말 것)
--
-- 설계 원칙
--   · 익명 수집: 이메일·IP·User-Agent 등 신원 정보를 저장하지 않는다.
--   · 테이블 직접 접근은 전면 차단하고, 아래 함수 2개로만 읽고 쓴다.
--     RLS만 걸고 select 정책을 열면 남의 문의를 전부 긁어갈 수 있기 때문이다.
--   · 비밀번호는 브라우저에서 SHA-256 해시한 값이 넘어오고, 여기서 다시 bcrypt로 저장한다.
--     평문은 서버에 도달하지 않고, DB가 유출돼도 오프라인 대입이 어렵다.
-- ============================================================

-- Supabase는 pgcrypto를 extensions 스키마에 미리 설치해 둔다.
-- 이미 있으면 아무 일도 일어나지 않는다.
create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- 테이블
-- ------------------------------------------------------------
create table if not exists public.feedback (
  id            bigint generated always as identity primary key,
  ticket_code   text        not null unique,
  password_hash text        not null,
  category      text        not null,
  body          text        not null,
  status        text        not null default 'received',
  reply         text,
  created_at    timestamptz not null default now(),
  replied_at    timestamptz,

  constraint feedback_body_len     check (char_length(body) between 5 and 2000),
  constraint feedback_category_ok  check (category in ('bug', 'accuracy', 'idea', 'etc')),
  constraint feedback_status_ok    check (status in ('received', 'reviewing', 'done', 'rejected'))
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

-- 테이블 직접 접근 차단: RLS를 켜고 정책을 하나도 만들지 않는다.
-- 정책이 없으면 anon 역할은 select/insert/update/delete 모두 불가능하다.
alter table public.feedback enable row level security;

revoke all on public.feedback from anon, authenticated;

-- ------------------------------------------------------------
-- 문의번호 생성
-- 헷갈리는 글자(0/O, 1/I/L)를 뺀 알파벳으로 8자리를 만든다.
-- ------------------------------------------------------------
create or replace function public.generate_ticket_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    exit when not exists (select 1 from public.feedback f where f.ticket_code = code);
  end loop;

  return code;
end;
$$;

-- ------------------------------------------------------------
-- 문의 접수
--   p_password_hash : 브라우저에서 계산한 SHA-256 16진 문자열(64자)
--   반환            : 문의번호
-- ------------------------------------------------------------
create or replace function public.submit_feedback(
  p_category      text,
  p_body          text,
  p_password_hash text
)
returns text
language plpgsql
security definer
-- Supabase는 pgcrypto를 extensions 스키마에 설치한다.
-- 여기에 extensions를 빼면 crypt()/gen_salt()를 찾지 못한다.
set search_path = public, extensions, pg_temp
as $$
declare
  new_code text;
begin
  if p_password_hash is null or p_password_hash !~ '^[0-9a-f]{64}$' then
    raise exception '비밀번호 형식이 올바르지 않습니다.';
  end if;

  if p_body is null or char_length(btrim(p_body)) < 5 then
    raise exception '문의 내용을 5자 이상 입력해주세요.';
  end if;

  if char_length(p_body) > 2000 then
    raise exception '문의 내용은 2000자까지 입력할 수 있습니다.';
  end if;

  new_code := public.generate_ticket_code();

  insert into public.feedback (ticket_code, password_hash, category, body)
  values (
    new_code,
    extensions.crypt(p_password_hash, extensions.gen_salt('bf')),   -- 넘어온 해시를 다시 bcrypt로 저장
    coalesce(p_category, 'etc'),
    btrim(p_body)
  );

  return new_code;
end;
$$;

-- ------------------------------------------------------------
-- 내 문의 조회 — 문의번호와 비밀번호가 모두 맞아야 한 건을 돌려준다.
-- ------------------------------------------------------------
create or replace function public.get_feedback(
  p_ticket        text,
  p_password_hash text
)
returns table (
  ticket_code text,
  category    text,
  body        text,
  status      text,
  reply       text,
  created_at  timestamptz,
  replied_at  timestamptz
)
language plpgsql
security definer
-- Supabase는 pgcrypto를 extensions 스키마에 설치한다.
-- 여기에 extensions를 빼면 crypt()/gen_salt()를 찾지 못한다.
set search_path = public, extensions, pg_temp
as $$
begin
  return query
  select f.ticket_code, f.category, f.body, f.status, f.reply, f.created_at, f.replied_at
  from public.feedback f
  where f.ticket_code = upper(btrim(p_ticket))
    and f.password_hash = extensions.crypt(p_password_hash, f.password_hash);
end;
$$;

-- ------------------------------------------------------------
-- 권한: 함수 실행만 허용한다.
-- ------------------------------------------------------------
revoke all on function public.generate_ticket_code() from public, anon, authenticated;

revoke all on function public.submit_feedback(text, text, text) from public;
revoke all on function public.get_feedback(text, text)          from public;

grant execute on function public.submit_feedback(text, text, text) to anon;
grant execute on function public.get_feedback(text, text)          to anon;

-- ============================================================
-- 운영 참고
--
-- 문의 확인 (Supabase 대시보드 SQL Editor에서 실행)
--   select id, ticket_code, category, status, created_at, body
--   from public.feedback order by created_at desc;
--
-- 답변 달기
--   update public.feedback
--   set reply = '확인 후 반영했습니다. 감사합니다.',
--       status = 'done',
--       replied_at = now()
--   where ticket_code = 'ABCD2345';
--
-- 한계
--   · 이 구성에는 스팸 방지 장치가 없다. 장난 글이 쌓이면 Supabase Edge Function으로
--     간단한 요청 제한(rate limit)이나 캡차를 앞단에 두는 것을 검토할 것.
--   · 익명 수집이므로 작성자에게 먼저 연락할 방법이 없다. 답변은 작성자가
--     문의번호와 비밀번호로 다시 조회해야 볼 수 있다.
-- ============================================================
