'use client';
// 큰 그림(전신·스테이지 그림)용 이미지 — 디코딩이 끝난 뒤에 나타나 위에서부터 끊겨 그려지는 모습이 보이지 않게 하고,
// 처음 나올 때 부드럽게 페이드 인한다. 그림이 바뀌면 새 그림이 준비될 때까지 이전 그림을 그대로 두었다가 교체한다.
import React, { useEffect, useState } from 'react';

export function FadeImg({ src, className, fade = true, ...rest }: { src: string; fade?: boolean } & Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    let dead = false;
    const im = new window.Image();
    im.src = src;
    const done = () => { if (!dead) setShown(src); };
    if (typeof im.decode === 'function') im.decode().then(done, done);
    else if (im.complete) done();
    else { im.onload = done; im.onerror = done; }
    return () => { dead = true; };
  }, [src]);
  if (!shown) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={shown} src={shown} className={`${className ?? ''}${fade ? ' img-fade' : ''}`.trim() || undefined} {...rest} />;
}
