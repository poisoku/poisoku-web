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
                  <div className="flex items-baseline gap-4">
                    <div className="relative">
                      <h1 className="text-4xl font-extralight tracking-wider relative z-10">
                        <span className="bg-gradient-to-br from-blue-600 via-violet-600 to-purple-700 bg-clip-text text-transparent">
                          ポイ速
                        </span>
                      </h1>
                      <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-blue-400/30 via-violet-400/50 to-purple-500/30 rounded-full"></div>
                    </div>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-2 h-2 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 animate-pulse"></div>
                      <p className="text-sm text-gray-500 font-light tracking-wide">
                        ポイントサイト案件検索エンジン
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {/* モバイル版 */}
              <div className="md:hidden text-center">
                <div className="relative">
                  <div className="relative inline-block">
                    <h1 className="text-3xl font-extralight tracking-wider relative z-10">
                      <span className="bg-gradient-to-br from-blue-600 via-violet-600 to-purple-700 bg-clip-text text-transparent">
                        ポイ速
                      </span>
                    </h1>
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3/4 h-0.5 bg-gradient-to-r from-blue-400/30 via-violet-400/50 to-purple-500/30 rounded-full"></div>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 animate-pulse"></div>
                    <p className="text-xs text-gray-500 font-light tracking-wide">
                      ポイントサイト案件検索エンジン
                    </p>
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 animate-pulse"></div>
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