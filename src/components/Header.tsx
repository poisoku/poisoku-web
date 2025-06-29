'use client';

import Link from 'next/link';

export default function Header() {

  return (
    <header className="bg-white md:sticky md:top-0 z-50">
      <div className="container mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-between md:justify-between justify-center">
          <Link href="/">
            <div className="cursor-pointer">
              {/* デスクトップ版 */}
              <div className="hidden md:block">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <h1 className="text-4xl font-bold tracking-tight">
                      <span className="text-gray-900">ポイ</span><span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">速</span>
                    </h1>
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full opacity-70"></div>
                  </div>
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full"></div>
                      <div className="w-12 h-px bg-gradient-to-r from-blue-600 to-purple-600"></div>
                      <div className="w-1.5 h-1.5 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full"></div>
                    </div>
                    <p className="text-sm font-medium text-gray-700 tracking-wide">
                      ポイントサイト案件検索エンジン
                    </p>
                  </div>
                </div>
              </div>
              {/* モバイル版 */}
              <div className="md:hidden text-center">
                <div className="relative inline-block mb-2">
                  <h1 className="text-3xl font-bold tracking-tight">
                    <span className="text-gray-900">ポイ</span><span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">速</span>
                  </h1>
                  <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full opacity-70"></div>
                </div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full"></div>
                  <div className="w-10 h-px bg-gradient-to-r from-blue-600 to-purple-600"></div>
                  <div className="w-1 h-1 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full"></div>
                </div>
                <p className="text-xs font-medium text-gray-700 tracking-wide">
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