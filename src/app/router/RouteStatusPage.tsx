import React from 'react';
import { navigatePath } from './browser';

export function RouteStatusPage({ status, home = '/' }: { status: 'unauthorized' | 'not-found'; home?: string }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#faf8f5] px-6 text-center text-[#24263e]">
      <p className="text-6xl font-black">{status === 'unauthorized' ? '403' : '404'}</p>
      <h1 className="text-xl font-bold">{status === 'unauthorized' ? 'Bạn không có quyền truy cập trang này' : 'Không tìm thấy trang'}</h1>
      <button className="rounded-xl bg-[#c34c36] px-5 py-3 font-bold text-white cursor-pointer" onClick={() => navigatePath(home, { replace: true })}>
        Về trang của bạn
      </button>
    </main>
  );
}
