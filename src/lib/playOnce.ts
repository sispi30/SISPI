'use client';
// 카드 등장 애니메이션을 게시판마다 한 번만 — 새로고침 뒤 그 게시판(주소의 첫 마디: /chars, /rels, /gallery …)을
// 처음 열 때만 재생하고, 다른 메뉴에 다녀와도 다시 재생하지 않는다. 새로고침하면 모두 처음부터.
// 그 게시판에서 첫 카드가 붙은 뒤 0.9초 안에 붙는 카드는 같은 첫 목록으로 보고 재생한다.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const firstSeen: Record<string, number> = {};

/** true면 이 카드는 이미 한 번 재생된 게시판에서 새로 붙은 것 — 애니메이션 없이 완성된 모습으로 */
export function usePlayedBefore(): boolean {
  const board = (usePathname() ?? '').split('/')[1] || 'home';
  const [still] = useState(() => !!firstSeen[board] && Date.now() - firstSeen[board] > 900);
  useEffect(() => { if (!firstSeen[board]) firstSeen[board] = Date.now(); }, [board]);
  return still;
}
