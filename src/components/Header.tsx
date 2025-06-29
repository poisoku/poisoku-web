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
                <div className="flex items-center gap-8">
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-100 via-indigo-50 to-purple-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative bg-white px-4 py-2 rounded-lg">
                      <h1 className="text-4xl font-bold tracking-wide bg-gradient-to-br from-gray-800 via-blue-700 to-indigo-600 bg-clip-text text-transparent">
                        ポイ速
                      </h1>
                      <div className="flex items-center justify-center mt-1 space-x-1">
                        <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                        <div className="w-2 h-1 bg-indigo-400 rounded-full"></div>
                        <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                  <div className="border-l-2 border-gradient-to-b from-blue-200 to-indigo-300 pl-6">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 tracking-wide">
                      ポイントサイト案件検索エンジン
                    </p>
                  </div>
                </div>
              </div>
              {/* モバイル版 */}
              <div className="md:hidden text-center">
                <div className="relative inline-block mb-4">
                  <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-100">
                    <h1 className="text-3xl font-bold tracking-wide bg-gradient-to-br from-gray-800 via-blue-700 to-indigo-600 bg-clip-text text-transparent">
                      ポイ速
                    </h1>
                    <div className="flex items-center justify-center mt-1 space-x-1">
                      <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                      <div className="w-2 h-1 bg-indigo-400 rounded-full"></div>
                      <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center space-x-1 mb-2">
                  <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                  <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                </div>
                <p className="text-xs font-semibold text-gray-700 tracking-wide">
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