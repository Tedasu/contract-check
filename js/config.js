/**
 * 문의함 서버(Supabase) 설정
 *
 * 1) https://supabase.com 에서 프로젝트를 만든다.
 * 2) SQL Editor에서 docs/supabase-setup.sql 전체를 실행한다.
 * 3) Project Settings → API 에서 아래 두 값을 복사해 넣는다.
 *
 * anon key는 브라우저에 노출되는 것을 전제로 만들어진 공개 키다. 커밋해도 된다.
 * service_role 키는 절대 여기에 넣지 말 것 — 모든 데이터를 읽고 쓸 수 있는 관리자 키다.
 *
 * 비워두면 문의함은 "서버 미연결" 상태로 표시되고 제출이 막힌다.
 */
window.APP_CONFIG = {
  SUPABASE_URL: 'https://rtghnietlkvoqyxkpfle.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_3MLqIf8IKR616u_-FTXL-g_iXeU7-yM',
};
