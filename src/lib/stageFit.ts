'use client';
// 화면 맞춤(1920 기준 무대 축소) — 태블릿·작은 창에서도 PC 화면(1920px 기준 배치)이 잘리지 않고 같은 비율로 보이게 한다.
//
// 메인·인트로의 배치는 1920px 폭 화면 기준 픽셀값이라, 더 좁은 화면에서는 양옆이 잘리거나 겹쳤다.
// 그래서 화면이 1920px보다 좁으면 그 비율(0~1)을 CSS 변수로 내려 주고, CSS가 `zoom`으로 같은 비율만큼 줄인다
// (zoom은 transform과 달리 레이아웃·좌표·fixed 자식이 그대로 맞다). 1920px 이상이면 변수를 비워 지금과 똑같이 둔다.
import { useEffect } from 'react';

interface FitOpts {
  /** 변수·클래스 이름 구분 — --ms-<name> / body.<name>-scaled */
  name: string;
  /** 이 폭 이하(모바일 레이아웃)에서는 적용 안 함 */
  minWidth: number;
  /** 기준 폭 */
  designW?: number;
  /** 높이까지 맞출 때의 기준 높이 (없으면 폭 기준으로만 줄임) */
  designH?: number;
}

export function useStageFit({ name, minWidth, designW = 1920, designH }: FitOpts) {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const cls = `${name}-scaled`;
    const v = `--ms-${name}`;
    const apply = () => {
      const w = window.innerWidth, h = window.innerHeight;
      let s = w > minWidth ? Math.min(1, w / designW) : 1;
      if (designH && w > minWidth) s = Math.min(s, h / designH);
      // 너무 작게 줄이지 않는다(글씨가 읽히는 한계)
      s = Math.max(0.3, s);
      if (s >= 0.999) {
        body.classList.remove(cls);
        root.style.removeProperty(v);
      } else {
        root.style.setProperty(v, s.toFixed(4));
        body.classList.add(cls);
      }
    };
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      body.classList.remove(cls);
      root.style.removeProperty(v);
    };
  }, [name, minWidth, designW, designH]);
}
