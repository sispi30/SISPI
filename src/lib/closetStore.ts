'use client';
// 페어 옷장 (드레스업) — 캐릭터 두 명을 세워 놓고 옷을 갈아입히는 페이지의 데이터
// 원본: 우초맨 「페어의 옷장 ver2」(그누보드5용 PHP) 를 이 홈의 메뉴 모듈로 옮긴 것.
// 설정 하나(ohome.closet.v1)에 옷·대사·디자인을 모두 담는다 — 관리자만 고칠 수 있고 방문자는 본다.
import { useCallback, useEffect, useState } from 'react';
import { getRawSetting, setSetting } from './settingStore';

export const CLOSET_KEY = 'ohome.closet.v1';

/** 옷 탭 — 키는 고정, 이름은 화면에 보이는 것 */
export const CLOSET_TABS: { key: string; label: string; zi: number }[] = [
  { key: 'bottom', label: '👖 하의', zi: 15 },
  { key: 'top', label: '👕 상의', zi: 20 },
  { key: 'shoes', label: '👟 신발', zi: 22 },
  { key: 'dress', label: '👗 원피스', zi: 20 },
  { key: 'outer', label: '🧥 외투', zi: 35 },
  { key: 'acc', label: '✨ 악세', zi: 40 },
  { key: 'bg', label: '🏞 배경', zi: 3 },
];

/** 여러 벌을 겹쳐 입을 수 있는 탭 (나머지는 탭당 한 벌 — 새로 입으면 이전 것이 벗겨진다) */
export const STACK_TABS = ['outer', 'acc', 'shoes', 'bg'];
/** 「옷을 입었다」로 치는 탭 — 이게 없으면 부끄러워하거나 추워한다 */
export const CLOTH_TABS = ['top', 'bottom', 'dress'];

export interface ClosetItem {
  id: string;
  src: string;      // 이미지 주소 (업로드 URL · 외부 주소 · /closet/sample/…)
  tab: string;      // CLOSET_TABS 의 key
  name: string;     // 이름 끝의 A/B(사이즈 표시)로 더블클릭 때 입힐 캐릭터를 정한다
  zi: number;       // 클수록 앞 (캐릭터 몸이 10)
  pair?: string;    // 비우면 모든 페어 공용 · 페어 id 를 적으면 그 페어에서만 보인다
}

export interface ClosetChar {
  name: string;
  label: string;        // 사이즈 표시 (아이템 이름 끝에 붙는 글자)
  bodies: string[];     // 표정 5장: 기본 · 말하는 · 웃는 · 방치/부끄러움 · 드문 반응
  width: number;
  height: number;
  blush: [number, number, number, number];   // 홍조 위치 left, top, width, height (px)
  outfit: string[];     // 처음 입고 나오는 옷 (아이템 id)
}

/** 페어 하나 — 캐릭터 두 명 · 대사 · 제목. 옷장(옷 목록)은 모든 페어가 같이 쓴다 */
export interface ClosetPair {
  id: string;
  name: string;         // 페어 구분 이름 (선택 칩에 보인다)
  title: string;
  saveName: string;
  chars: [ClosetChar, ClosetChar];
  dialogue: [Record<string, string>, Record<string, string>];
}

export interface ClosetData {
  pairs: ClosetPair[];
  items: ClosetItem[];
}

/** 이 페어에서 보이는 옷 — 공용 + 이 페어 전용 */
export const itemsForPair = (items: ClosetItem[], pairId: string) =>
  items.filter(i => !i.pair || i.pair === pairId);

/** 대사 칸 — 키 · 이름 · 언제 나오는지 · 여러 줄(무작위) 여부 */
export const DIALOGUE_FIELDS: { key: string; label: string; when: string; multi?: boolean }[] = [
  { key: 'welcome', label: '인사', when: '페이지에 들어왔을 때' },
  { key: 'reset_all', label: '다시 입히기', when: '「다시 입히기」를 눌렀을 때' },
  { key: 'save_photo', label: '저장', when: '「찰칵!」으로 그림을 저장했을 때' },
  { key: 'too_many', label: '과다착용', when: '악세사리를 5개 이상 걸쳤을 때' },
  { key: 'nothing', label: '벗길옷없음', when: '입은 게 없는데 「전부 벗기!」를 눌렀을 때' },
  { key: 'panic_enter', label: '전부벗기', when: '「전부 벗기!」를 눌렀을 때' },
  { key: 'panic_click', label: '패닉중 클릭', when: '벗겨진 직후에 캐릭터를 눌렀을 때' },
  { key: 'panic_exit', label: '패닉해제', when: '벗겨진 직후에 옷을 입혀 줬을 때' },
  { key: 'return_msg', label: '방치복귀', when: '방치되다가 다시 옷을 입혀 줬을 때' },
  { key: 'return_panic', label: '부끄럼중 장식', when: '부끄러워하는 중에 옷이 아닌 것을 입혀 줬을 때' },
  { key: 'thanks_msg', label: '부끄럼해제', when: '부끄러워하는 중에 옷을 입혀 줬을 때' },
  { key: 'rare_msg', label: '희귀', when: '방치 중 10% 확률로 나오는 드문 대사' },
  { key: 'blush_msg', label: '부끄럼', when: '부끄러워하는 중의 대사 · 눌렀을 때' },
  { key: 'idle_stage1', label: '방치 1단계', when: '가만히 두고 30초쯤 지났을 때' },
  { key: 'idle_stage2', label: '방치 2단계', when: '1단계 후 15초 더 지났을 때' },
  { key: 'wait_partner', label: '상대 대기', when: '상대방을 입히는 중에 방치됐을 때' },
  { key: 'boast_success', label: '알몸 방치', when: '옷 없이 방치됐을 때' },
  { key: 'idle_list', label: '혼잣말', when: '완전히 방치됐을 때 (줄바꿈 = 무작위)', multi: true },
  { key: 'click_list', label: '클릭 반응', when: '캐릭터를 눌렀을 때 (줄바꿈 = 무작위)', multi: true },
  { key: 'dress_list', label: '입혔을 때', when: '옷을 입혔을 때 (줄바꿈 = 무작위)', multi: true },
  { key: 'take_off_list', label: '벗길 때', when: '옷을 하나 벗겼을 때 (줄바꿈 = 무작위)', multi: true },
];

const SAMPLE = '/closet/sample';
const bodies = (n: 1 | 2) => [1, 2, 3, 4, 5].map(i => `${SAMPLE}/c${n}body${i === 1 ? '' : i}.png`);

const SAMPLE_ITEMS: ClosetItem[] = [
  { id: 'base-wear0', src: `${SAMPLE}/wear0.png`, tab: 'dress', name: '기본 원피스 A', zi: 20 },
  { id: 'base-wear1', src: `${SAMPLE}/wear1.png`, tab: 'dress', name: '기본 원피스 B', zi: 20 },
  { id: 'base-ace1', src: `${SAMPLE}/ace1_2.png`, tab: 'acc', name: '기본 장식 A', zi: 40 },
  { id: 'base-ace2', src: `${SAMPLE}/ace2_2.png`, tab: 'acc', name: '기본 장식 B', zi: 40 },
];

/** 새 페어 — 샘플 그림과 안내 대사 (outfit 은 비어 있으면 알몸으로 시작하니 호출한 쪽이 채운다) */
export function newPair(id: string, name: string, outfit: [string[], string[]] = [[], []]): ClosetPair {
  const dlg = (who: string) => Object.fromEntries(
    DIALOGUE_FIELDS.map(f => [f.key, f.multi
      ? [1, 2, 3].map(i => `${f.label} ${who} 대사 ${i}`).join('\n')
      : `${f.label} ${who} 대사`]),
  );
  return {
    id, name, title: `${name}의 옷장`, saveName: '옷장',
    chars: [
      { name: '캐릭터A', label: 'A', bodies: bodies(1), width: 300, height: 600, blush: [100, 92, 100, 56], outfit: outfit[0] },
      { name: '캐릭터B', label: 'B', bodies: bodies(2), width: 300, height: 600, blush: [100, 92, 100, 56], outfit: outfit[1] },
    ],
    dialogue: [dlg('A'), dlg('B')],
  };
}

/** 처음 열었을 때 보이는 예시 */
export function defaultCloset(): ClosetData {
  return {
    pairs: [{ ...newPair('p1', '페어 1', [['base-wear0', 'base-ace1'], ['base-wear1', 'base-ace2']]), title: '페어명의 옷장' }],
    items: SAMPLE_ITEMS,
  };
}

/** 페어 한 칸 보정 — 빠진 값은 기본값으로 */
function normalizePair(raw: Partial<ClosetPair>, id: string, fallbackName: string): ClosetPair {
  const d = newPair(id, raw.name || fallbackName);
  const chars = d.chars.map((dc, i) => {
    const rc = raw.chars?.[i];
    if (!rc) return dc;
    return {
      ...dc, ...rc,
      bodies: dc.bodies.map((b, n) => (rc.bodies?.[n] ?? b) || b),
      blush: (Array.isArray(rc.blush) && rc.blush.length === 4 ? rc.blush : dc.blush) as ClosetChar['blush'],
      outfit: Array.isArray(rc.outfit) ? rc.outfit : dc.outfit,
    };
  }) as ClosetPair['chars'];
  const dialogue = d.dialogue.map((dd, i) => ({ ...dd, ...(raw.dialogue?.[i] ?? {}) })) as ClosetPair['dialogue'];
  return {
    ...d, id, chars, dialogue,
    title: typeof raw.title === 'string' ? raw.title : d.title,
    saveName: typeof raw.saveName === 'string' ? raw.saveName : d.saveName,
  };
}

/** 저장된 값에 빠진 칸이 있어도 화면이 깨지지 않게 채운다.
 *  페어가 생기기 전(옷장 하나) 형식은 「페어 1」 로 옮겨 담는다 — 저장된 옷장이 그대로 이어진다 */
type RawCloset = Partial<ClosetData> & Partial<ClosetPair>;
function normalize(raw: RawCloset | null | undefined): ClosetData {
  const d = defaultCloset();
  if (!raw || typeof raw !== 'object') return d;
  const rawPairs: Partial<ClosetPair>[] = Array.isArray(raw.pairs) && raw.pairs.length ? raw.pairs : [raw];
  const seen = new Set<string>();
  const pairs = rawPairs.map((p, i) => {
    let id = typeof p.id === 'string' && p.id && !seen.has(p.id) ? p.id : `p${i + 1}`;
    while (seen.has(id)) id += 'x';
    seen.add(id);
    return normalizePair(p, id, `페어 ${i + 1}`);
  });
  return {
    pairs,
    items: Array.isArray(raw.items)
      ? raw.items.filter(it => it && typeof it.src === 'string' && it.src)
        .map(it => ({
          ...it, id: String(it.id), tab: CLOSET_TABS.some(t => t.key === it.tab) ? it.tab : 'top', zi: Number(it.zi) || 0,
          // 없어진 페어 전용으로 남은 옷은 공용으로
          pair: it.pair && seen.has(it.pair) ? it.pair : undefined,
        }))
      : d.items,
  };
}

export function useCloset(): [ClosetData, (next: ClosetData) => void, boolean] {
  const [data, setData] = useState<ClosetData>(() => defaultCloset());
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        const raw = getRawSetting(CLOSET_KEY);
        setData(normalize(raw ? JSON.parse(raw) : null));
      } catch { setData(defaultCloset()); }
    };
    read();
    setLoaded(true);
  }, []);
  const save = useCallback((next: ClosetData) => {
    setData(next);
    try { setSetting(CLOSET_KEY, next); } catch { /* 무시 */ }
  }, []);
  return [data, save, loaded];
}
