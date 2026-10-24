'use client';
// 썸네일 아래쪽이 밝은지 재서 알려 준다 — 밝은 그림이면 어두운 글자·밝은 그라데이션을 쓰기 위함.
// 캔버스에 작게 그려 평균 밝기를 구한다. 다른 출처 그림은 getBlob 으로 받아 같은 출처 주소로 그린다.
import { useEffect, useState } from 'react';
import { getBlob } from '@/lib/blobStore';

const cache = new Map<string, boolean>();

export function useBottomLight(ref: string | undefined, enabled: boolean): boolean {
  const [light, setLight] = useState<boolean>(() => (ref ? cache.get(ref) ?? false : false));
  useEffect(() => {
    if (!enabled || !ref) { setLight(false); return; }
    const hit = cache.get(ref);
    if (hit != null) { setLight(hit); return; }
    let dead = false;
    let obj: string | null = null;
    (async () => {
      try {
        const b = await getBlob(ref);
        if (!b || dead) return;
        obj = URL.createObjectURL(b);
        const im = new Image();
        im.onload = () => {
          if (dead) return;
          try {
            const W = 24, H = 24;
            const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
            const cx = cv.getContext('2d', { willReadFrequently: true });
            if (!cx) return;
            cx.drawImage(im, 0, 0, W, H);
            // 글자가 놓이는 아래쪽 약 45% 구간의 평균 밝기 (투명은 흰 바탕으로 본다)
            const y0 = Math.floor(H * 0.55);
            const d = cx.getImageData(0, y0, W, H - y0).data;
            let sum = 0, n = 0;
            for (let i = 0; i < d.length; i += 4) {
              const a = d[i + 3] / 255;
              const r = d[i] * a + 255 * (1 - a), g = d[i + 1] * a + 255 * (1 - a), bl = d[i + 2] * a + 255 * (1 - a);
              sum += 0.2126 * r + 0.7152 * g + 0.0722 * bl; n++;
            }
            const v = n ? sum / n / 255 : 0;
            const res = v > 0.6;
            cache.set(ref, res);
            setLight(res);
          } catch { /* 읽기 실패 — 기존 어두운 디자인 유지 */ }
        };
        im.src = obj;
      } catch { /* 무시 */ }
    })();
    return () => { dead = true; if (obj) setTimeout(() => URL.revokeObjectURL(obj!), 1000); };
  }, [ref, enabled]);
  return light;
}
