'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const [searchRankingTop10, setSearchRankingTop10] = useState<any[]>([]);
  const [isLoadingRanking, setIsLoadingRanking] = useState(true);

  useEffect(() => {
    fetchRankingData();
  }, []);

  const fetchRankingData = async () => {
    try {
      // モックデータを使用
      const mockRanking = [
        { rank: 1, keyword: 'Yahoo!ショッピング', site: 'ハピタス', cashback: '1.0%', change: 0 },
        { rank: 2, keyword: '楽天市場', site: 'ハピタス', cashback: '1.0%', change: 0 },
        { rank: 3, keyword: 'Amazon', site: 'モッピー', cashback: '0.5%', change: 0 },
        { rank: 4, keyword: 'じゃらん', site: 'ハピタス', cashback: '2.0%', change: 0 },
        { rank: 5, keyword: 'ZOZOTOWN', site: 'ハピタス', cashback: '1.0%', change: 0 },
        { rank: 6, keyword: '楽天トラベル', site: 'ハピタス', cashback: '1.5%', change: 0 },
        { rank: 7, keyword: 'dカード', site: 'ハピタス', cashback: '8000円', change: 0 },
        { rank: 8, keyword: 'U-NEXT', site: 'ハピタス', cashback: '1200円', change: 0 },
        { rank: 9, keyword: 'Netflix', site: 'モッピー', cashback: '500円', change: 0 },
        { rank: 10, keyword: '楽天カード', site: 'ハピタス', cashback: '10000円', change: 0 },
      ];
      setSearchRankingTop10(mockRanking);
    } catch (error) {
      console.error('ランキング取得エラー:', error);
    } finally {
      setIsLoadingRanking(false);
    }
  };

  const popularCategories = [
    { name: 'ショッピング', icon: '🛍️', count: 45, slug: 'shopping' },
    { name: '旅行', icon: '✈️', count: 28, slug: 'travel' },
    { name: 'アプリ', icon: '📱', count: 35, slug: 'app' },
    { name: 'クレカ', icon: '💳', count: 42, slug: 'creditcard' },
    { name: 'マネー', icon: '💰', count: 38, slug: 'money' },
    { name: 'エンタメ', icon: '🎬', count: 25, slug: 'entertainment' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />

      {/* ヒーローセクション */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-transparent to-purple-50 opacity-60"></div>
        <div className="container mx-auto max-w-6xl px-4 py-16 relative">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
              高還元のポイントサイトを
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                一発検索
              </span>
            </h2>
          </div>

          {/* 検索フォーム */}
          <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-2xl opacity-20 group-hover:opacity-30 transition-opacity blur-xl"></div>
              <div className="relative flex bg-white rounded-2xl shadow-xl overflow-hidden">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Yahoo!ショッピング、楽天市場など..."
                  className="flex-1 px-6 py-4 text-lg focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium hover:from-blue-700 hover:to-blue-600 transition-all duration-200"
                >
                  検索
                </button>
              </div>
            </div>
            <p className="text-center text-sm text-gray-500 mt-3">
              スペースで区切るとAND検索ができます
            </p>
          </form>

          {/* モバイル用ナビリンク */}
          <div className="md:hidden mt-6 flex justify-center gap-6">
            <Link href="/guide" className="text-xs text-gray-600 hover:text-blue-600 transition-colors">
              📖 ポイ速の使い方
            </Link>
            <Link href="/settings" className="text-xs text-gray-600 hover:text-blue-600 transition-colors">
              ⚙️ サイト選択/除外
            </Link>
            <Link href="/ranking" className="text-xs text-gray-600 hover:text-blue-600 transition-colors">
              🔥 検索ランキング
            </Link>
          </div>

          {/* カテゴリーカード */}
          <div className="mt-12 max-w-3xl mx-auto">
            <h3 className="text-xl font-semibold text-gray-700 text-center mb-2">カテゴリーで探す</h3>
            <div className="w-16 h-1 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto mb-8"></div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {popularCategories.map((category) => (
                <Link
                  key={category.name}
                  href={`/category/${category.slug}`}
                  className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 block text-center"
                >
                  <div className="text-2xl mb-2">{category.icon}</div>
                  <p className="text-xs font-medium text-gray-700">{category.name}</p>
                  <p className="text-xs text-gray-500">{category.count}件</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* メインコンテンツ */}
      <main className="container mx-auto max-w-6xl px-4 py-12">
        {/* 検索ランキング */}
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">🔥 検索ランキング TOP10</h2>
            <a href="/ranking" className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
              すべて見る
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          <div className="space-y-3">
            {isLoadingRanking ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : searchRankingTop10.map((item) => (
              <div
                key={item.rank}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                    ${item.rank <= 3 ? 'bg-gradient-to-br from-yellow-400 to-orange-400 text-white' : 'bg-gray-100 text-gray-600'}
                  `}>
                    {item.rank}
                  </div>
                  <div>
                    <a
                      href={`/search?q=${encodeURIComponent(item.keyword)}`}
                      className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {item.keyword}
                    </a>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500">最高還元: {item.site}</span>
                      {item.change !== 0 && (
                        <span className={`text-xs font-medium ${item.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.change > 0 ? '↑' : '↓'} {Math.abs(item.change)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-green-600">{item.cashback}</p>
                  <p className="text-xs text-gray-500">還元率</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 更新情報 */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            検索ランキングは 0:01 / 6:01 / 12:01 / 18:01 に自動更新されます
          </p>
        </div>

        {/* ポイ速の特徴 */}
        <div className="mt-16 mb-16">
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50 opacity-60"></div>
            <div className="relative max-w-4xl mx-auto py-12 px-6">
              <h3 className="text-xl font-semibold text-gray-700 text-center mb-2">ポイ速の特徴</h3>
              <div className="w-16 h-1 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto mb-8"></div>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="group">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:border-blue-200 transition-all duration-300">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                        <span className="text-2xl">🔍</span>
                      </div>
                      <div className="flex flex-col justify-center h-12">
                        <h4 className="font-semibold text-gray-900 text-lg leading-tight">かんたん検索</h4>
                        <p className="text-sm text-gray-600 leading-tight">
                          案件名を入力するだけで一発検索
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="group">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:border-orange-200 transition-all duration-300">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                        <span className="text-2xl">🔥</span>
                      </div>
                      <div className="flex flex-col justify-center h-12">
                        <h4 className="font-semibold text-gray-900 text-lg leading-tight">人気案件を発見</h4>
                        <p className="text-sm text-gray-600 leading-tight">
                          ランキングで話題の案件をチェック
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="group">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:border-green-200 transition-all duration-300">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                        <span className="text-2xl">📊</span>
                      </div>
                      <div className="flex flex-col justify-center h-12">
                        <h4 className="font-semibold text-gray-900 text-lg leading-tight">1週間の最高額表示</h4>
                        <p className="text-sm text-gray-600 leading-tight">
                          案件のお得度がすぐわかる
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* フッター */}
      <footer className="bg-gray-50 mt-20 md:mt-20">
        <div className="container mx-auto max-w-6xl px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-gray-900 mb-4">ポイ速</h3>
              <p className="text-sm text-gray-600">
                ポイントサイト案件を効率的に検索して、最高の還元率を見つけましょう。
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">メニュー</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/guide" className="text-gray-600 hover:text-blue-600">ポイ速の使い方</a></li>
                <li><a href="/settings" className="text-gray-600 hover:text-blue-600">サイト選択/除外</a></li>
                <li><a href="/ranking" className="text-gray-600 hover:text-blue-600">検索ランキング</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">人気キーワード</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/search?q=Yahoo!ショッピング" className="text-gray-600 hover:text-blue-600">Yahoo!ショッピング</a></li>
                <li><a href="/search?q=楽天市場" className="text-gray-600 hover:text-blue-600">楽天市場</a></li>
                <li><a href="/search?q=Amazon" className="text-gray-600 hover:text-blue-600">Amazon</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">お問い合わせ</h4>
              <p className="text-sm text-gray-600">
                ご意見・ご要望がございましたら、お気軽にお問い合わせください。
              </p>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-gray-500">
            <p>© 2025 ポイ速 - ポイントサイト案件検索エンジン</p>
          </div>
        </div>
      </footer>
    </div>
  );
}