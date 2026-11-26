// 무드맵 설정. 아래 두 값(프로젝트 URL, anon public key)은 브라우저에 공개되어도 되는 값입니다.
// 절대로 service_role 키나 DB 비밀번호를 넣지 마세요. 접근 제어는 Supabase RLS(서버)가 담당합니다.
window.MOODMAP_CONFIG = {
  SUPABASE_URL: "https://qtwryammhbtaztuahddp.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0d3J5YW1taGJ0YXp0dWFoZGRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU3MDIyODQsImV4cCI6MjExMTI3ODI4NH0.gl3mQWL8XCKLeJCSviGP8v-qI2qIgrocrxFx_zn8ddQ",
  NEARBY_RADIUS_M: 500, // 내 주변 기록 표시 반경(미터)
  CONSULT_ENDPOINT: "" // 선택. 예: "https://formspree.io/f/xxxxxxx" (비우면 이 브라우저에만 저장)
};
