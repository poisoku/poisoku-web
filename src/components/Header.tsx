'use client';

import Link from 'next/link';

export default function Header() {

  return (
    <header className="bg-white/80 backdrop-blur-md shadow-sm md:sticky md:top-0 z-50">
      <div className="container mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/">
            <div className="cursor-pointer">
              {/* デスクトップ版 */}
              <div className="hidden md:block">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                  ポイ速
                </h1>
                <p className="text-xs text-gray-600 mt-0.5">ポイントサイト案件検索エンジン</p>
              </div>
              {/* モバイル版 */}
              <div className="md:hidden flex items-center gap-2">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                  ポイ速
                </h1>
                <p className="text-xs text-gray-600">ポイントサイト案件検索エンジン</p>
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
        
        {/* モバイル用ナビリンク */}
        <div className="md:hidden mt-4 flex justify-center gap-6 pb-4 border-b">
          <Link href="/guide" className="text-xs text-gray-600 hover:text-blue-600 transition-colors">
            ポイ速の使い方
          </Link>
          <Link href="/settings" className="text-xs text-gray-600 hover:text-blue-600 transition-colors">
            サイト選択/除外
          </Link>
          <Link href="/ranking" className="text-xs text-gray-600 hover:text-blue-600 transition-colors">
            検索ランキング
          </Link>
        </div>
      </div>
    </header>
  );
}