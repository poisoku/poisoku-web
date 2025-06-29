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
                    <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 relative">
                      ポイ速
                      <div className="absolute -top-1 -right-2 w-2 h-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full opacity-80"></div>
                    </h1>
                    <div className="flex items-center mt-2 space-x-1">
                      <div className="w-3 h-px bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                      <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                      <div className="w-6 h-px bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                    </div>
                  </div>
                  <div className="flex flex-col justify-center">
                    <div className="flex items-center mb-1">
                      <div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full mr-3"></div>
                      <p className="text-sm font-medium text-gray-700 tracking-wide">
                        ポイントサイト案件検索エンジン
                      </p>
                    </div>
                    <div className="flex items-center space-x-1 ml-4">
                      <div className="w-2 h-px bg-blue-400"></div>
                      <div className="w-0.5 h-0.5 bg-indigo-400 rounded-full"></div>
                      <div className="w-3 h-px bg-indigo-400"></div>
                    </div>
                  </div>
                </div>
              </div>
              {/* モバイル版 */}
              <div className="md:hidden text-center">
                <div className="relative inline-block mb-3">
                  <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 relative">
                    ポイ速
                    <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full opacity-80"></div>
                  </h1>
                  <div className="flex items-center justify-center mt-2 space-x-1">
                    <div className="w-2 h-px bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                    <div className="w-0.5 h-0.5 bg-blue-500 rounded-full"></div>
                    <div className="w-4 h-px bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                  </div>
                </div>
                <div className="flex items-center justify-center mb-2">
                  <div className="w-0.5 h-3 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full mr-2"></div>
                  <p className="text-xs font-medium text-gray-700 tracking-wide">
                    ポイントサイト案件検索エンジン
                  </p>
                </div>
                <div className="flex items-center justify-center space-x-1">
                  <div className="w-1.5 h-px bg-blue-400"></div>
                  <div className="w-0.5 h-0.5 bg-indigo-400 rounded-full"></div>
                  <div className="w-2 h-px bg-indigo-400"></div>
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