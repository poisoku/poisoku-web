'use client';

import Link from 'next/link';

export default function Header() {

  return (
    <header className="md:sticky md:top-0 z-50">
      <div className="container mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-between md:justify-between justify-center">
          <Link href="/">
            <div className="cursor-pointer">
              {/* デスクトップ版 */}
              <div className="hidden md:block">
                <div className="flex items-center gap-4">
                  <h1 className="text-4xl font-bold tracking-tight">
                    <span className="bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-700 bg-clip-text text-transparent">ポ</span>
                    <span className="text-slate-800">イ</span>
                    <span className="bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-700 bg-clip-text text-transparent">速</span>
                  </h1>
                  <p className="text-xs text-slate-600 font-medium tracking-wide">
                    ポイントサイト案件検索エンジン
                  </p>
                </div>
              </div>
              {/* モバイル版 */}
              <div className="md:hidden text-center">
                <h1 className="text-3xl font-bold tracking-tight mb-2">
                  <span className="bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-700 bg-clip-text text-transparent">ポ</span>
                  <span className="text-slate-800">イ</span>
                  <span className="bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-700 bg-clip-text text-transparent">速</span>
                </h1>
                <p className="text-xs text-slate-600 font-medium tracking-wide">
                  ポイントサイト案件検索エンジン
                </p>
              </div>
            </div>
          </Link>
          
          {/* デスクトップナビゲーション */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/guide" className="text-gray-600 hover:text-blue-600 transition-colors text-sm font-medium">
              ポイ速の使い方
            </Link>
            <Link href="/settings" className="text-gray-600 hover:text-blue-600 transition-colors text-sm font-medium">
              サイト選択/除外
            </Link>
            <Link href="/ranking" className="text-gray-600 hover:text-blue-600 transition-colors text-sm font-medium">
              検索ランキング
            </Link>
          </nav>

        </div>
      </div>
    </header>
  );
}