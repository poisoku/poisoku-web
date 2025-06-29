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
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-2xl group-hover:blur-3xl transition-all duration-700 opacity-50"></div>
                    <h1 className="relative text-4xl font-extrabold tracking-tighter text-gray-600">
                      ポイ速
                    </h1>
                    <div className="absolute -bottom-3 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 rounded-full"></div>
                  </div>
                  <div className="relative">
                    <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-indigo-400 to-transparent opacity-50"></div>
                    <p className="text-sm font-bold text-gray-600 tracking-wide uppercase">
                      ポイントサイト案件検索エンジン
                    </p>
                    <div className="flex items-center mt-2 space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse delay-75"></div>
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse delay-150"></div>
                    </div>
                  </div>
                </div>
              </div>
              {/* モバイル版 */}
              <div className="md:hidden text-center">
                <div className="relative group inline-block mb-4">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-xl opacity-50"></div>
                  <h1 className="relative text-3xl font-extrabold tracking-tighter text-gray-600">
                    ポイ速
                  </h1>
                  <div className="absolute -bottom-2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-full"></div>
                </div>
                <p className="text-xs font-bold text-gray-600 tracking-wide uppercase mb-2">
                  ポイントサイト案件検索エンジン
                </p>
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse delay-75"></div>
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse delay-150"></div>
                </div>
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