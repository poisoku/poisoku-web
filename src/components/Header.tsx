'use client';

import Link from 'next/link';

export default function Header() {

  return (
    <header className="bg-white/95 backdrop-blur-md shadow-sm md:sticky md:top-0 z-50">
      <div className="container mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-between md:justify-between justify-center">
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
              <div className="md:hidden">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent text-center">
                  ポイ速
                </h1>
                <p className="text-xs text-gray-500 text-center mt-1">ポイントサイト案件検索エンジン</p>
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
        <div className="md:hidden mt-6 pb-4">
          <div className="flex justify-center gap-8 py-3">
            <Link href="/guide" className="text-xs font-medium text-gray-600 hover:text-blue-600 transition-colors py-2 px-3 rounded-lg hover:bg-white hover:shadow-sm">
              使い方
            </Link>
            <Link href="/settings" className="text-xs font-medium text-gray-600 hover:text-blue-600 transition-colors py-2 px-3 rounded-lg hover:bg-white hover:shadow-sm">
              サイト設定
            </Link>
            <Link href="/ranking" className="text-xs font-medium text-gray-600 hover:text-blue-600 transition-colors py-2 px-3 rounded-lg hover:bg-white hover:shadow-sm">
              ランキング
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}