'use client';
// 마이룸 리모콘(카탈로그) 패널 (v1) — 그누보드판 view.skin.php의 「꾸미기」 탭에 해당.
// 카테고리별로 등록된 아이템을 클릭하면 캔버스에 놓이고, 관리자는 이 화면에서 바로
// 카테고리·카탈로그 아이템을 추가/삭제/이름변경/순서변경할 수 있다.
import React, { useRef, useState } from 'react';
import { BlobImg, putBlob } from '@/lib/blobStore';
import { newId } from '@/lib/postStore';
import type { MyRoomCatalogItem, MyRoomCategory } from '@/lib/myroomStore';

function probeImage(file: File): Promise<{ w: number; h: number }> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth || 120, h: img.naturalHeight || 120 }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ w: 120, h: 120 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

export function CatalogPanel({
  categories, catalog, isAdmin, onAddToCanvas, onCategoriesChange, onCatalogChange,
}: {
  categories: MyRoomCategory[];
  catalog: MyRoomCatalogItem[];
  isAdmin: boolean;
  onAddToCanvas: (item: MyRoomCatalogItem) => void;
  onCategoriesChange: (next: MyRoomCategory[]) => void;
  onCatalogChange: (next: MyRoomCatalogItem[]) => void;
}) {
  const cats = [...categories].sort((a, b) => a.sort - b.sort);
  const [activeCat, setActiveCat] = useState(cats[0]?.id ?? '');
  const curCat = cats.find(c => c.id === activeCat) ? activeCat : (cats[0]?.id ?? '');
  const items = catalog.filter(it => it.categoryId === curCat).sort((a, b) => a.sort - b.sort);
  const [manageOpen, setManageOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addCategory = () => {
    const name = window.prompt('카테고리 이름')?.trim();
    if (!name) return;
    const nextSort = (cats[cats.length - 1]?.sort ?? 0) + 1;
    onCategoriesChange([...categories, { id: newId(), name, sort: nextSort }]);
  };
  const renameCategory = (id: string, name: string) =>
    onCategoriesChange(categories.map(c => (c.id === id ? { ...c, name } : c)));
  const moveCategory = (id: string, dir: -1 | 1) => {
    const idx = cats.findIndex(c => c.id === id);
    const swap = cats[idx + dir];
    if (!swap) return;
    const a = cats[idx];
    onCategoriesChange(categories.map(c => {
      if (c.id === a.id) return { ...c, sort: swap.sort };
      if (c.id === swap.id) return { ...c, sort: a.sort };
      return c;
    }));
  };
  const deleteCategory = (id: string) => {
    if (cats.length <= 1) { alert('최소 1개의 카테고리는 남아있어야 합니다.'); return; }
    if (!window.confirm('이 카테고리와 안의 아이템을 모두 삭제하시겠습니까?')) return;
    onCategoriesChange(categories.filter(c => c.id !== id));
    onCatalogChange(catalog.filter(it => it.categoryId !== id));
  };

  const addCatalogItem = async (file: File) => {
    if (!curCat) { alert('먼저 카테고리를 만들어주세요.'); return; }
    setUploading(true);
    try {
      const [{ w, h }, src] = await Promise.all([probeImage(file), putBlob(file)]);
      const nextSort = (items[items.length - 1]?.sort ?? 0) + 1;
      onCatalogChange([...catalog, {
        id: newId(), categoryId: curCat, name: file.name.replace(/\.[^.]+$/, '').slice(0, 50),
        src, w, h, sort: nextSort,
      }]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const deleteCatalogItem = (id: string) => {
    if (!window.confirm('이 아이템을 보관함에서 삭제하시겠습니까? (이미 배치된 것은 남습니다)')) return;
    onCatalogChange(catalog.filter(it => it.id !== id));
  };

  return (
    <div className="mr-catalog">
      <div className="mr-catalog-tabs">
        {cats.map(c => (
          <button key={c.id} type="button" className={curCat === c.id ? 'on' : ''} onClick={() => setActiveCat(c.id)}>
            {c.name}
          </button>
        ))}
        {isAdmin && <button type="button" className="mr-catalog-tab-add" onClick={addCategory} title="카테고리 추가">＋</button>}
      </div>

      <div className="mr-catalog-grid">
        {items.map(it => (
          <div key={it.id} className="mr-catalog-item" onClick={() => onAddToCanvas(it)} title={it.name}>
            <BlobImg fileRef={it.src} imgStyle={{ objectFit: 'contain' }} />
            {isAdmin && (
              <button type="button" className="mr-catalog-item-remove" onClick={e => { e.stopPropagation(); deleteCatalogItem(it.id); }}>×</button>
            )}
          </div>
        ))}
        {isAdmin && (
          <label className="mr-catalog-item mr-catalog-add">
            {uploading ? '…' : '＋'}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) addCatalogItem(f); }} />
          </label>
        )}
        {items.length === 0 && !isAdmin && <p className="mr-catalog-empty">등록된 아이템이 없습니다</p>}
      </div>

      {isAdmin && (
        <details className="mr-catalog-manage" open={manageOpen} onToggle={e => setManageOpen((e.target as HTMLDetailsElement).open)}>
          <summary>카테고리 관리</summary>
          {cats.map((c, idx) => (
            <div key={c.id} className="mr-catalog-manage-row">
              <input value={c.name} onChange={e => renameCategory(c.id, e.target.value)} />
              <button type="button" disabled={idx === 0} onClick={() => moveCategory(c.id, -1)}>↑</button>
              <button type="button" disabled={idx === cats.length - 1} onClick={() => moveCategory(c.id, 1)}>↓</button>
              <button type="button" className="danger" onClick={() => deleteCategory(c.id)}>삭제</button>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
