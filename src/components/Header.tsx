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
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <h1 className="text-4xl font-black tracking-tight">
                      <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                        ポイ速
                      </span>
                    </h1>
                    <div className="flex flex-col">
                      <div className="w-12 h-px bg-gradient-to-r from-blue-400 to-purple-400"></div>
                      <div className="w-8 h-px bg-gradient-to-r from-purple-400 to-indigo-400 mt-1"></div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 font-medium mt-1 ml-1">ポイントサイト案件検索エンジン</p>
                </div>
              </div>
              {/* モバイル版 */}
              <div className="md:hidden text-center">
                <div className="relative">
                  <div className="flex items-center justify-center gap-2">
                    <div className="flex flex-col">
                      <div className="w-6 h-px bg-gradient-to-r from-blue-400 to-purple-400"></div>
                      <div className="w-4 h-px bg-gradient-to-r from-purple-400 to-indigo-400 mt-0.5"></div>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight">
                      <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                        ポイ速
                      </span>
                    </h1>
                    <div className="flex flex-col">
                      <div className="w-6 h-px bg-gradient-to-r from-blue-400 to-purple-400"></div>
                      <div className="w-4 h-px bg-gradient-to-r from-purple-400 to-indigo-400 mt-0.5"></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 font-medium mt-2">ポイントサイト案件検索エンジン</p>
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