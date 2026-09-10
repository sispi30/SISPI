// TRPG 룰별 "기본 정보 항목" 필드 정의 — 그누보드 TRPG 캐릭터 시트 스킨(write_skin.php)의
// RULE_CONFIG를 자놀 캐릭터(/chars) 게시판용으로 옮긴 것.
//
// 그누보드 스킨은 wr_1~wr_10 고정 슬롯의 라벨/타입을 룰마다 바꿔치기하는 방식이었지만,
// 여기서는 슬롯 대신 Spec(기본 정보 항목) 배열을 룰별로 새로 만들어 끼워 넣는 방식을 쓴다.
// wr_1(캐릭터 이름)·wr_5(원어 이름)는 이미 Character.name/sub가 담당하고 있어 포팅 대상에서 뺐다.
import { newId } from '@/lib/postStore';

export type SpecFieldType = 'text' | 'select' | 'gauge' | 'relation_table' | 'skill_table' | 'status_block';

export interface GaugeRowValue { key: string; cur: string; max?: string; noMax?: boolean }
export interface RelationColumnDef { key: string; label: string; type: 'text' | 'checkbox' }
export type RelationRowValue = Record<string, string | boolean>;
export interface SkillCategoryDef { label: string; skills: string[] }
export interface StatusBlockValue {
  level?: string;
  prideCur?: string; prideMax?: string;
  sub?: Record<string, { cur?: string; max?: string }>;
  debt?: string; money?: string; upkeep?: string; interest?: string;
}

/** 기본 정보 항목 한 줄. 기존 {label,value} 자유 항목과 100% 호환 —
 *  type이 없으면(또는 'text') 지금까지와 똑같은 라벨/값 텍스트 항목이다. */
export interface Spec {
  label: string;
  value: string;
  /** 룰 필드 슬롯 키(f2, f3...) — 룰을 바꿔도 같은 슬롯이면 입력값을 이어받기 위한 용도.
   *  자유 추가 항목에는 없다. */
  key?: string;
  type?: SpecFieldType;
  options?: string[];                       // type: select
  gauges?: GaugeRowValue[];                  // type: gauge
  relationColumns?: RelationColumnDef[];     // type: relation_table
  relationRows?: RelationRowValue[];         // type: relation_table
  skillCategories?: SkillCategoryDef[];      // type: skill_table
  skillChecked?: Record<string, boolean>;    // type: skill_table — key `${category}::${skill}`
  status?: StatusBlockValue;                 // type: status_block
  subStats?: string[];                       // type: status_block
}

export interface RuleFieldDef {
  key: string;           // f2, f3, f4, f6, f7, f8, f9, f10 (그누보드 wr_N 슬롯 대응)
  label: string;
  type: SpecFieldType;
  placeholder?: string;
  options?: string[];                   // select
  gaugeKeys?: string[];                  // gauge
  gaugeNoMax?: string[];                 // gauge — 상한 없는 누적형(현재값만)
  columns?: RelationColumnDef[];         // relation_table
  categories?: SkillCategoryDef[];       // skill_table
  subStats?: string[];                   // status_block
}

export const RULE_OPTIONS = [
  'CoC 7판', '더블크로스 3rd', '마기카로기아', '인세인',
  '시노비가미', '언성듀엣', '둘이서 수사', '벤탱글',
] as const;

const DEFAULT_RELATION_COLUMNS: RelationColumnDef[] = [
  { key: 'name', label: '인물', type: 'text' },
  { key: 'place', label: '거처', type: 'checkbox' },
  { key: 'secret', label: '비밀', type: 'checkbox' },
  { key: 'emotion', label: '감정', type: 'text' },
];

export const RULE_CONFIG: Record<string, RuleFieldDef[]> = {
  'CoC 7판': [
    { key: 'f2', label: '직업', type: 'text' },
    { key: 'f3', label: '나이 | 키', type: 'text' },
    { key: 'f4', label: '시대 | 국적', type: 'text' },
    { key: 'f6', label: '특징', type: 'text' },
    { key: 'f7', label: '신념', type: 'text' },
    { key: 'f8', label: 'HP | MP | SAN | 행운', type: 'gauge', gaugeKeys: ['HP', 'MP', 'SAN', '행운'] },
    { key: 'f9', label: '캐치프레이즈', type: 'text' },
    { key: 'f10', label: '특성치 (근력, 건강, 크기, 민첩, 외모, 지능, 정신력, 교육)', type: 'text', placeholder: '50, 50, 50, 50, 50, 50, 50, 50' },
  ],
  '더블크로스 3rd': [
    { key: 'f2', label: 'CODENAME', type: 'text' },
    { key: 'f3', label: 'AGE | HEIGHT', type: 'text' },
    { key: 'f4', label: 'WORKS(커버)', type: 'text' },
    { key: 'f6', label: 'SYNDROME(신드롬)', type: 'text' },
    { key: 'f7', label: 'AWAKE | IMPULSE(각성 | 충동)', type: 'text' },
    { key: 'f8', label: 'DLOIS(로이스)', type: 'text' },
    { key: 'f9', label: '한 줄 인용구', type: 'text' },
    { key: 'f10', label: '4대 능력치 (근력, 내구, 감각, 정신)', type: 'text', placeholder: '5, 1, 1, 2' },
  ],
  '마기카로기아': [
    { key: 'f2', label: '마법명', type: 'text' },
    { key: 'f3', label: '영역 | 혼의 특기', type: 'text' },
    { key: 'f4', label: '경력 | 기관', type: 'text' },
    { key: 'f6', label: '사회적 신분', type: 'text' },
    { key: 'f7', label: '진정한 모습', type: 'text' },
    { key: 'f8', label: '공적점 | 마화', type: 'gauge', gaugeKeys: ['공적점', '마화'], gaugeNoMax: ['공적점', '마화'] },
    { key: 'f9', label: '한마디', type: 'text' },
    { key: 'f10', label: '특성치 (계제, 공격력, 방어력, 근원력)', type: 'text', placeholder: '1, 1, 1, 1' },
  ],
  '인세인': [
    { key: 'f2', label: '직업', type: 'text' },
    { key: 'f3', label: '나이 | 키', type: 'text' },
    { key: 'f4', label: '호기심 | 공포심', type: 'text' },
    { key: 'f6', label: '특기', type: 'text' },
    { key: 'f7', label: '어빌리티', type: 'text' },
    { key: 'f8', label: '생명력 | 이성치 | 공적점', type: 'gauge', gaugeKeys: ['생명력', '이성치', '공적점'], gaugeNoMax: ['공적점'] },
    { key: 'f9', label: '한마디', type: 'text' },
    {
      key: 'f10', label: '관계', type: 'relation_table',
      columns: [
        { key: 'name', label: '인물', type: 'text' },
        { key: 'place', label: '거처', type: 'checkbox' },
        { key: 'secret', label: '비밀', type: 'checkbox' },
        { key: 'emotion', label: '감정', type: 'text' },
      ],
    },
  ],
  '시노비가미': [
    { key: 'f2', label: '유파 | 하위유파', type: 'text' },
    { key: 'f3', label: '대외적 신분 | 계급', type: 'text' },
    { key: 'f4', label: '특기분야 | 오의', type: 'text' },
    { key: 'f6', label: '숙적 | 신념', type: 'text' },
    // wr_7 슬롯을 이 룰에서는 쓰지 않으므로(hide) 필드 정의 자체를 뺐다
    { key: 'f8', label: '추가생명력 | 공적점', type: 'gauge', gaugeKeys: ['추가생명력', '공적점'], gaugeNoMax: ['공적점'] },
    { key: 'f9', label: '한마디', type: 'text' },
    {
      key: 'f10', label: '관계', type: 'relation_table',
      columns: [
        { key: 'name', label: '인물', type: 'text' },
        { key: 'place', label: '거처', type: 'checkbox' },
        { key: 'secret', label: '비밀', type: 'checkbox' },
        { key: 'ougi', label: '오의', type: 'checkbox' },
        { key: 'emotion', label: '감정', type: 'text' },
        { key: 'etc', label: '기타', type: 'text' },
      ],
    },
  ],
  '언성듀엣': [
    { key: 'f2', label: '포지션', type: 'select', options: ['바인더', '시프터'] },
    { key: 'f3', label: '나이 | 키', type: 'text' },
    { key: 'f4', label: '직업', type: 'text' },
    { key: 'f6', label: '1인칭 | 어조', type: 'text' },
    { key: 'f7', label: '말버릇', type: 'text' },
    { key: 'f8', label: '소중한 추억', type: 'text' },
    { key: 'f9', label: '한마디', type: 'text' },
    {
      key: 'f10', label: '프래그먼트', type: 'relation_table',
      columns: [
        { key: 'fragment', label: '프래그먼트', type: 'text' },
        { key: 'forget', label: '망각', type: 'checkbox' },
        { key: 'mutation', label: '변이', type: 'text' },
      ],
    },
  ],
  '둘이서 수사': [
    { key: 'f2', label: '클래스 | 배경', type: 'text' },
    { key: 'f3', label: '연령 | 신장', type: 'text' },
    { key: 'f4', label: '패션 특징', type: 'text' },
    { key: 'f6', label: '좋아하는 것 | 싫어하는 것', type: 'text' },
    { key: 'f7', label: '직업', type: 'text' },
    { key: 'f8', label: '파트너', type: 'text' },
    { key: 'f9', label: '한마디', type: 'text' },
    {
      key: 'f10', label: '기능표', type: 'skill_table',
      categories: [
        { label: '통찰', skills: ['거짓말', '변화', '외견', '물리', '현장', '날치기'] },
        { label: '감식', skills: ['교통', '정보', '지문', '과학', '법의학', '생물'] },
        { label: '인간', skills: ['사교', '가사', '소문', '설득', '유행', '비즈니스'] },
        { label: '육체', skills: ['포박', '방어', '근성', '체력', '돌파', '추적'] },
      ],
    },
  ],
  '벤탱글': [
    { key: 'f2', label: '본명', type: 'text' },
    { key: 'f3', label: '연령 | 신장', type: 'text' },
    { key: 'f4', label: '속성 | 파워', type: 'text' },
    { key: 'f6', label: '오리진 | 어뎁트', type: 'text' },
    { key: 'f7', label: '사연 | 경력', type: 'text' },
    { key: 'f8', label: '거주 | 의상 | 바디레인지', type: 'text' },
    { key: 'f9', label: '한마디', type: 'text' },
    {
      key: 'f10', label: 'STATUS', type: 'status_block',
      subStats: ['카르마', '어드밴티지', '리로드', '배리어', '초기 BS'],
    },
  ],
};

/** 룰 필드 정의 하나를 빈 값의 Spec으로 변환 */
function emptySpecFromDef(def: RuleFieldDef): Spec {
  const base: Spec = { label: def.label, value: '', key: def.key, type: def.type };
  if (def.type === 'select') {
    base.options = def.options;
    base.value = def.options?.[0] ?? '';
  } else if (def.type === 'gauge') {
    base.gauges = (def.gaugeKeys ?? []).map(k => ({ key: k, cur: '', max: '', noMax: def.gaugeNoMax?.includes(k) }));
  } else if (def.type === 'relation_table') {
    base.relationColumns = def.columns ?? DEFAULT_RELATION_COLUMNS;
    base.relationRows = [];
  } else if (def.type === 'skill_table') {
    base.skillCategories = def.categories ?? [];
    base.skillChecked = {};
  } else if (def.type === 'status_block') {
    base.subStats = def.subStats ?? [];
    base.status = { sub: {} };
  } else if (def.placeholder) {
    base.value = '';
  }
  return base;
}

/**
 * 룰 이름을 선택했을 때 기본 정보 항목(Spec[])을 새로 구성한다.
 * 이전에 입력해 두었던 값이 있으면(prevSpecs), 같은 슬롯(key)이고 타입이 같은 필드는
 * 값을 그대로 이어받는다 — 그누보드 스킨이 룰을 바꿔도 wr_N 슬롯 값을 유지하던 동작과 동일.
 */
export function buildSpecsFromRule(ruleName: string, prevSpecs?: Spec[]): Spec[] {
  const defs = RULE_CONFIG[ruleName];
  if (!defs) return [];
  return defs.map(def => {
    const fresh = emptySpecFromDef(def);
    const prev = prevSpecs?.find(s => s.key === def.key && s.type === def.type);
    if (prev) {
      return { ...fresh, value: prev.value, gauges: prev.gauges ?? fresh.gauges, relationRows: prev.relationRows ?? fresh.relationRows,
        skillChecked: prev.skillChecked ?? fresh.skillChecked, status: prev.status ?? fresh.status };
    }
    return fresh;
  });
}

/** 관계표(relation_table)의 빈 행 하나 생성 */
export function emptyRelationRow(columns: RelationColumnDef[]): RelationRowValue {
  const row: RelationRowValue = {};
  columns.forEach(c => { row[c.key] = c.type === 'checkbox' ? false : ''; });
  return row;
}

/** status_block의 유지비+이자 합계(총 지불액) 계산 — 저장하지 않고 항상 다시 계산해 보여준다 */
export function statusTotal(status?: StatusBlockValue): number {
  const upkeep = parseFloat(status?.upkeep ?? '') || 0;
  const interest = parseFloat(status?.interest ?? '') || 0;
  return upkeep + interest;
}

export const newSpecId = newId;
