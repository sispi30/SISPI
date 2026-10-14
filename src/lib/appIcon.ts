// 어플(홈 화면) 아이콘 주소 만들기 — 매니페스트·애플 터치 아이콘 공용 (서버에서만 쓴다)
//
// 환경설정에서 올린 그림은 저장소(파이어베이스/수파베이스)의 외부 주소다. 그걸 매니페스트에 그대로
// 적으면 ① 크롬이 설치 가능 여부를 따질 때 그림을 못 받거나 ② 선언한 크기와 실제 그림 크기가 안 맞거나
// ③ 형식(JPG·WebP 등)이 안 맞아 「이 앱을 설치할 수 없습니다」가 뜬다.
// 그래서 같은 출처의 /api/app-icon 이 그림을 받아 정확한 크기의 PNG로 내주고, 매니페스트는 그 주소만 적는다.

/** 지정 아이콘이 바뀌면 주소도 바뀌게 하는 짧은 지문 — 브라우저·기기 캐시를 끊는다 */
function fingerprint(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export const APP_ICON_SIZES = [180, 192, 512] as const;

export function appIconSrc(size: (typeof APP_ICON_SIZES)[number], url: string): string {
  return `/api/app-icon?s=${size}&v=${fingerprint(url)}`;
}
