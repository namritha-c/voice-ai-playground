'use client';
// TEMPORARY visual check — deleted after review.
import { useEffect } from 'react';
import Playground from '@/views/Playground';

export default function MenuTest() {
  useEffect(() => {
    const t = setTimeout(() => {
      const which = new URLSearchParams(location.search).get('open');
      document.querySelector<HTMLElement>(which === 'model' ? '#model' : '.prov-btn')?.click();
    }, 2500);
    return () => clearTimeout(t);
  }, []);
  return <Playground mode="tts" />;
}
