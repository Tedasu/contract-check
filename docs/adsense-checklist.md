# 구글 애드센스 심사 준비 점검

이 문서는 2026년 8월 기준으로 진행한 점검 결과와 이후 해야 할 일을 정리한 것이다.

## 이번에 고친 것

| 문제 | 조치 |
|---|---|
| 개인정보처리방침 없음 (필수) | [privacy.html](../privacy.html) 작성 — 수집 항목, 쿠키/localStorage, 제3자 스크립트(pdf.js·Tesseract CDN), Supabase, 향후 AdSense 쿠키 안내 포함 |
| 이용약관 없음 | [terms.html](../terms.html) 작성 |
| 소개/신뢰 정보 없음 | [about.html](../about.html) 작성 — 목적, 하지 않는 것, 판정 방식 설명 |
| **콘텐츠가 업로드해야만 보임** | 홈 화면에 **업로드 없이 보이는 정적 미리보기** 섹션 추가 (`renderPreview()` in [js/app.js](../js/app.js)). 유형 탭을 눌러도 즉시 갱신된다. 크롤러와 심사자가 첫 화면에서 바로 실제 콘텐츠(항목명 + 설명)를 보게 된다 |
| sitemap.xml / robots.txt 없음 | 루트에 추가, robots.txt가 sitemap을 가리킴 |
| canonical / OG / Twitter Card / JSON-LD 없음 | 4개 페이지 모두에 추가 |
| 페이지당 h1이 2개(헤더 브랜드명 + 본문 제목) | 헤더 브랜드명을 `<p class="brand-title">`로 변경, 각 페이지에 h1 하나만 남김 (index는 시각적으로 숨긴 h1 사용) |
| og-image 없음 | [og-image.svg](../og-image.svg) — 1200×630 |
| 하위 페이지가 다크모드를 무시함 | about/privacy/terms에 테마 동기화 스크립트 추가 |

## 아직 남은 것 — 애드센스 승인 후에 해야 함

애드센스는 **광고 코드를 붙이기 전에는 발급되지 않는 정보**가 있어서, 지금은 준비만 해두고
승인 후 아래를 채워야 한다.

1. **ads.txt** — 애드센스 게시자 ID(`pub-xxxxxxxxxxxxxxxx`)를 발급받으면 사이트 루트에
   `ads.txt` 파일을 추가해야 한다. 형식:
   ```
   google.com, pub-xxxxxxxxxxxxxxxx, DIRECT, f08c47fec0942fa0
   ```
   이 파일이 없으면 광고 수익이 제한되거나 계정 경고를 받을 수 있다. **가짜 값으로 미리
   만들어두지 말 것** — 잘못된 게시자 ID는 심사에 불리하게 작용한다.

2. **광고 코드 삽입** — 승인 후 애드센스가 주는 `<script>` 태그를 `index.html`,
   `about.html`, `privacy.html`, `terms.html`의 `<head>`에 추가한다.

## 검토는 했지만 지금은 손대지 않은 것

- **EU 방문자 동의 배너(CMP)** — 구글은 EEA·영국·스위스 방문자에게 광고를 보여주려면
  구글이 인증한 동의관리플랫폼(CMP)을 통해 동의를 받도록 요구한다(Google EU 최종
  사용자 동의 정책). 이 사이트는 한국어 전용이라 EU 트래픽 비중이 낮을 것으로 보이지만,
  0은 아니다. 애드센스 승인 후 계정의 "개인 정보 보호 및 메시지" 설정에서 구글이 제공하는
  기본 CMP를 켜는 것으로 충분한 경우가 많다 — 별도 코드 작업이 필요 없을 수 있으니
  애드센스 대시보드에서 먼저 확인할 것.
- **도메인** — 지금은 `contract-check-one.vercel.app` 서브도메인이다. 애드센스는
  서브도메인도 심사 대상으로 받아주지만, 커스텀 도메인이 신뢰도·브랜딩 면에서 유리하다.
  도메인을 바꾸면 `sitemap.xml`, `robots.txt`, 4개 페이지의 `canonical`·OG URL을
  전부 새 도메인으로 갱신해야 한다 (문자열 `contract-check-one.vercel.app`로 검색하면
  전부 찾을 수 있다).
- **콘텐츠 총량** — 미리보기 섹션 추가로 크게 개선됐지만, 애드센스는 "페이지 수"도
  본다. 지금은 4페이지(홈/소개/개인정보/약관)뿐이다. 승인이 반려된다면 계약 유형별로
  전체 항목을 보여주는 페이지를 따로 만드는 것(`/guide/employment.html` 등)을
  고려할 것.

## 승인 신청 전 마지막 체크리스트

- [ ] 위 표의 조치 사항이 실제 배포 도메인에 반영됐는지 확인 (`git push` 후 Vercel 배포 완료)
- [ ] Google Search Console에 사이트 등록하고 `sitemap.xml` 제출
- [ ] 사이트가 최소 며칠 이상 실제로 접속 가능한 상태로 운영되고 있는지 확인 (애드센스는
      갓 만든 사이트보다 어느 정도 운영 이력이 있는 사이트를 선호하는 경향이 있음 — 공식
      기준은 아니지만 실무적으로 자주 언급됨)
- [ ] [about.html](../about.html) 등 페이지가 검색엔진에 실제로 색인됐는지
      `site:contract-check-one.vercel.app` 로 확인
