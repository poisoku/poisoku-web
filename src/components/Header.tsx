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
                    <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 via-blue-800 to-blue-600 bg-clip-text text-transparent">
                      ポイ速
                    </h1>
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-gradient-to-br from-gray-700 to-blue-500 rounded-full opacity-80"></div>
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-gray-800 to-blue-500 rounded-full opacity-60"></div>
                  </div>
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-gradient-to-br from-gray-700 to-blue-500 rounded-full"></div>
                      <div className="w-12 h-px bg-gradient-to-r from-gray-600 to-blue-600"></div>
                      <div className="w-1.5 h-1.5 bg-gradient-to-br from-gray-600 to-blue-400 rounded-full"></div>
                    </div>
                    <p className="text-sm font-medium text-gray-700 tracking-wide">
                      ポイントサイト案件検索エンジン
                    </p>
                  </div>
                </div>
              </div>
              {/* モバイル版 */}
              <div className="md:hidden text-center">
                <div className="relative inline-block mb-3">
                  <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 via-blue-800 to-blue-600 bg-clip-text text-transparent">
                    ポイ速
                  </h1>
                  <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-gradient-to-br from-gray-700 to-blue-500 rounded-full opacity-80"></div>
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-gray-800 to-blue-500 rounded-full opacity-60"></div>
                </div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 bg-gradient-to-br from-gray-700 to-blue-500 rounded-full"></div>
                  <div className="w-10 h-px bg-gradient-to-r from-gray-600 to-blue-600"></div>
                  <div className="w-1 h-1 bg-gradient-to-br from-gray-600 to-blue-400 rounded-full"></div>
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