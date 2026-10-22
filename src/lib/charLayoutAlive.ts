import { createContext } from 'react';

/** chars/[id]/layout.tsx 가 아직 화면에 붙어 있는지 — 레이아웃이 떠나는 중이면 false.
 *  페이지(상세)의 정리 코드가 "레이아웃이 null 로 되돌린 뒤에" 기본색을 다시 칠해 버리는 걸 막는다. */
export const CharLayoutAlive = createContext<{ current: boolean } | null>(null);
