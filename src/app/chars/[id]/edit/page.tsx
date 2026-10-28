'use client';
// 캐릭터 프로필 편집 페이지 (4.4) — 전용 페이지 (모달 아님)
// ?au=<relId:auId> 로 진입하면 그 AU 전용 프로필 편집 (v1.9 사용자 확정) —
// 아예 새 프로필처럼 이름·스펙·아트·탭 전부 그 AU만의 값으로 작성. base는 건드리지 않음.
import React, { Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { Character, CHAR_SEED, charGrant, charWithAu, auProfileOf, ownAuKey, Relation, REL_SEED , findByKey } from '@/lib/charStore';
import { usePageBgm } from '@/lib/bgmStore';
import { CharEditForm } from '@/components/chars/CharEditForm';
import { useToast } from '@/components/ui/Toast';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';
import { AuLinkBox } from '@/components/chars/AuLinkBox';

function CharEditInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const params = useSearchParams();
  const auKey = params.get('au');   // `${relId}:${auId}`
  const [chars, setChars, loaded] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const [rels] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);

  // 별명 주소로도 열린다 (v2.0 사용자 요청 — 주소를 나중에 바꿔도 옛 주소가 살아 있게)
  const ch = findByKey(chars, id);
  // 관리자 또는 「편집까지」 권한이 부여된 회원 (3차 회원-캐릭터 연결, v1.9)
  const canEdit = isAdmin || (ch && charGrant(ch, user?.id) === 'edit');
  // 수정 화면에서도 이 캐릭터에 지정해 둔 BGM을 들을 수 있게 — 상세와 같은 키라 상세에서 이어서 들린다
  usePageBgm(loaded && canEdit && ch ? `char:${ch.id}` : undefined, loaded && canEdit && ch ? ch.bgm : undefined);
  if (!loaded) return <section className="page" />;
  if (!canEdit || !ch) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>EDIT</PageTitle><p>{!ch ? '캐릭터를 찾을 수 없습니다' : '편집 권한이 없습니다'}</p></div>
      </section>
    );
  }

  // AU 라벨 (타이틀 표시용)
  const auLabel = (() => {
    if (!auKey) return null;
    if (auKey.startsWith('own:')) return ch.ownAus?.find(a => ownAuKey(a.id) === auKey)?.label ?? auKey;
    const [relId, auId] = auKey.split(':');
    return rels.find(r => r.id === relId)?.aus.find(a => a.id === auId)?.label ?? auKey;
  })();

  const back = auKey ? `/chars/${ch.id}?au=${encodeURIComponent(auKey)}` : `/chars/${ch.id}`;

  // AU 프로필 초기값 (v1.9 사용자 확정) — 이미 등록된 AU면 그 값, 처음이면 "아예 새 등록"처럼 빈 폼
  // (이름·스펙·아트·탭 전부 비움 — 폰트·대표색 등 스타일 기본만 base에서)
  const auProf = auKey ? auProfileOf(ch, auKey) : undefined;
  const formInitial = auKey
    ? (auProf
      ? charWithAu(ch, auKey)
      : {
        ...ch, name: '', sub: '', altName: undefined, themeTone: undefined, artShadow: undefined, deco: undefined, decoBg: undefined, decoFontId: undefined, decoScript: undefined, decoGhost: undefined, bodyInk: undefined, bodyInkColor: undefined, basicHtml: '', tabs: [], colors: [], colorTipMode: 'hex' as const,
        specs: [{ label: '성별', value: '' }, { label: '키', value: '' }],
        arts: [], artId: undefined, thumbId: undefined, thumbCrop: undefined,
        bgImgId: undefined, bgBlur: undefined,
        gallery: undefined, galleryPosts: undefined, galleryTagLinks: undefined,   // 새 AU의 서랍은 비어서 시작 (사진은 물려받지 않는다)
      })
    : ch;

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>EDIT — {auKey ? `${ch.name} · ${auLabel}` : ch.name}</PageTitle>
        {!auKey && <EditableDesc k="chars-edit-desc" def="프로필 편집 — 변경은 [SAVE]를 눌러야 저장됩니다" />}
      </div>
      {auKey?.startsWith('own:') && (
        <AuLinkBox ch={ch} auKey={auKey} rels={rels} chars={chars}
          onChange={link => setChars(chars.map(x => (x.id === ch.id
            ? { ...x, ownAus: (x.ownAus ?? []).map(a => (ownAuKey(a.id) === auKey ? { ...a, link } : a)) } : x)))} />
      )}
      <CharEditForm
        key={auKey ?? 'base'}   // 기본 프로필 편집 → AU 편집으로 주소만 바뀔 때 폼 상태가 남아 기존 값이 보이던 것 방지
        initial={formInitial}
        existingIds={chars.filter(c => c.id !== ch.id).flatMap(c => [c.id, ...(c.slug ? [c.slug] : [])])}
        auMode={!!auKey}
        auKey={auKey ?? undefined}
        onCancel={() => router.push(back)}
        onSave={c => {
          if (auKey) {
            // AU 프로필 스냅샷 저장 — base 필드는 그대로, auProfiles[auKey]만 폼 값 전체로
            setChars(chars.map(x => (x.id === ch.id ? {
              ...x,
              // 이 AU의 관계란 (원본 관계란은 건드리지 않는다)
              auRel: c.auRel, relEnabled: c.relEnabled ?? x.relEnabled,
              auProfiles: {
                ...x.auProfiles,
                [auKey]: {
                  // 폼 밖에서 정한 값(상세 아트 위치 등)은 그대로 두고 폼 값만 덮어쓴다 (v2.0)
                  ...x.auProfiles?.[auKey],
                  name: c.name, sub: c.sub, altName: c.altName ?? '',
                  bodyInk: c.bodyInk ?? 'auto', artShadow: c.artShadow ?? 'auto', deco: c.deco ?? 'on', decoBg: c.decoBg ?? 'full', decoFontId: c.decoFontId ?? '', decoScript: c.decoScript ?? null, decoGhost: c.decoGhost ?? null, bodyInkColor: c.bodyInkColor, color: c.color, themeMode: c.themeMode, themeTone: c.themeTone ?? 'site',
                  colors: c.colors, colorTipMode: c.colorTipMode,
                  specs: c.specs, rule: c.rule, sheetUrl: c.sheetUrl, tabs: c.tabs, basicHtml: c.basicHtml,
                  arts: c.arts, thumbId: c.thumbId, thumbCrop: c.thumbCrop,
                  bgImgId: c.bgImgId, bgBlur: c.bgBlur,
                  fontId: c.fontId, nameSize: c.nameSize, nameBold: c.nameBold, bodyFontId: c.bodyFontId,
                  // 서랍(갤러리)도 AU별로 — 원본 갤러리를 건드리지 않고, 이 AU로 전환했을 때 이 값이 서랍에 반영된다
                  galleryOwn: true, galleryPosts: c.galleryPosts, galleryTagLinks: c.galleryTagLinks,
                },
              },
            } : x)));
            toast('AU 프로필이 저장되었습니다');
          } else {
            // 폼이 다루지 않는 값(상세 아트 위치 등)이 저장할 때마다 사라지지 않게 덮어쓰지 않고 합친다 (v2.0)
            setChars(chars.map(x => (x.id === c.id ? { ...x, ...c } : x)));
            toast('저장되었습니다');
          }
          router.push(back);
        }}
      />
    </section>
  );
}

export default function CharEditPage() {
  // useSearchParams는 Suspense 경계 필요 (Next App Router)
  return <Suspense fallback={<section className="page" />}><CharEditInner /></Suspense>;
}
