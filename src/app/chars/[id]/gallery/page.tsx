'use client';
// 갤러리가 이제 상세 화면의 GALLERY 탭(우측 패널 교체 방식)으로 통합됨 (v3.1) —
// 예전 주소(/chars/{id}/gallery)로 들어오는 북마크·링크를 위해 리다이렉트만 해 준다.
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CharGalleryRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => { router.replace(`/chars/${id}?tab=gallery`); }, [id, router]);
  return null;
}
