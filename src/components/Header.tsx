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
                <div className="group cursor-pointer">
                  <div className="flex items-center gap-8">
                    <div className="relative">
                      <div className="absolute -inset-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 blur-sm"></div>
                      <div className="relative">
                        <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-600 bg-clip-text text-transparent">
                          ポイ速
                        </h1>
                        <div className="absolute -top-2 -right-2 w-3 h-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full animate-pulse"></div>
                        <div className="absolute -bottom-3 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-full opacity-30"></div>
                      </div>
                    </div>
                    <div className="flex flex-col justify-center space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full"></div>
                        <div className="w-16 h-px bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                        <div className="w-1.5 h-1.5 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-full"></div>
                      </div>
                      <p className="text-sm font-semibold text-slate-600 tracking-wide leading-tight">
                        ポイントサイト案件検索エンジン
                      </p>
                      <div className="flex items-center space-x-2 opacity-60">
                        <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                        <div className="w-6 h-px bg-gradient-to-r from-blue-300 to-indigo-400"></div>
                        <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* モバイル版 */}
              <div className="md:hidden text-center">
                <div className="group">
                  <div className="relative inline-block mb-4">
                    <div className="absolute -inset-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 blur-sm"></div>
                    <div className="relative">
                      <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-600 bg-clip-text text-transparent">
                        ポイ速
                      </h1>
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full animate-pulse"></div>
                      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-full opacity-40"></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full"></div>
                      <div className="w-12 h-px bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                      <div className="w-1 h-1 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-full"></div>
                    </div>
                    <p className="text-xs font-semibold text-slate-600 tracking-wide">
                      ポイントサイト案件検索エンジン
                    </p>
                    <div className="flex items-center justify-center space-x-1 opacity-50">
                      <div className="w-0.5 h-0.5 bg-blue-400 rounded-full"></div>
                      <div className="w-4 h-px bg-gradient-to-r from-blue-300 to-indigo-400"></div>
                      <div className="w-0.5 h-0.5 bg-indigo-400 rounded-full"></div>
                    </div>
                  </div>
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