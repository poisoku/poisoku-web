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
                <div className="relative group">
                  <div className="absolute -inset-2 bg-gradient-to-r from-rose-50 via-blue-50 to-violet-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-700 blur-sm"></div>
                  <div className="relative bg-white/80 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/20 shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <h1 className="text-4xl font-bold tracking-tight relative">
                          <span className="text-slate-800">ポ</span>
                          <span className="bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-700 bg-clip-text text-transparent">イ</span>
                          <span className="text-slate-800">速</span>
                        </h1>
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full animate-bounce"></div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-px bg-gradient-to-r from-emerald-300 to-cyan-400"></div>
                          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                            <div className="w-1 h-1 bg-white rounded-full"></div>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 font-medium tracking-wide uppercase">
                          Point Site Search Engine
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* モバイル版 */}
              <div className="md:hidden text-center">
                <div className="relative group">
                  <div className="absolute -inset-2 bg-gradient-to-r from-rose-50 via-blue-50 to-violet-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-700 blur-sm"></div>
                  <div className="relative bg-white/80 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/20 shadow-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="w-4 h-px bg-gradient-to-r from-emerald-300 to-cyan-400"></div>
                      <div className="relative">
                        <h1 className="text-3xl font-bold tracking-tight">
                          <span className="text-slate-800">ポ</span>
                          <span className="bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-700 bg-clip-text text-transparent">イ</span>
                          <span className="text-slate-800">速</span>
                        </h1>
                        <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full animate-bounce"></div>
                      </div>
                      <div className="w-4 h-px bg-gradient-to-r from-cyan-400 to-blue-500"></div>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                        <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
                      </div>
                      <p className="text-xs text-slate-600 font-medium tracking-wide">
                        ポイントサイト案件検索エンジン
                      </p>
                      <div className="w-2 h-2 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                        <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
                      </div>
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