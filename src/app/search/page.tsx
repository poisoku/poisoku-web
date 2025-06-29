'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import Header from '@/components/Header';

interface SearchResult {
  id: string;
  siteName: string;
  cashback: string;
  device: 'PC' | 'iOS' | 'Android' | 'All' | 'iOS/Android';
  url: string;
  lastUpdated: string;
  description?: string;
  campaignUrl?: string;
  pointSiteUrl?: string;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [maxCashback7Days, setMaxCashback7Days] = useState<{
    amount: string;
    site: string;
    date: string;
  } | null>(null);

  useEffect(() => {
    if (query) {
      searchCampaigns(query);
    }
  }, [query]);

  const searchCampaigns = async (searchQuery: string) => {
    setLoading(true);
    try {
      // ローカルストレージから設定を取得
      const settings = localStorage.getItem('pointSiteSettings') || '{}';
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&settings=${encodeURIComponent(settings)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '検索に失敗しました');
      }

      // APIレスポンスを表示用の形式に変換
      const formattedResults: SearchResult[] = data.campaigns.map((campaign: any) => ({
        id: campaign.id,
        siteName: campaign.point_sites.name,
        cashback: campaign.cashback_rate,
        device: campaign.device,
        url: campaign.campaign_url || campaign.point_sites.url,
        lastUpdated: new Date(campaign.updated_at).toLocaleString('ja-JP'),
        description: campaign.name, // 案件名をdescriptionに格納
        campaignUrl: campaign.campaign_url, // スクレイピングで取得した案件ページのURL
        pointSiteUrl: campaign.point_sites.url, // ポイントサイトのURL
      }));

      setResults(formattedResults);

      // 過去7日間の最高額
      if (data.maxCashback7Days) {
        setMaxCashback7Days({
          amount: data.maxCashback7Days.cashback_rate,
          site: data.maxCashback7Days.campaigns.point_sites.name,
          date: new Date(data.maxCashback7Days.recorded_at).toLocaleDateString('ja-JP'),
        });
      }
    } catch (error) {
      console.error('検索エラー:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'PC':
        return { icon: '💻', label: 'PC' };
      case 'iOS':
        return { icon: '📱', label: 'iOS' };
      case 'Android':
        return { icon: '🤖', label: 'Android' };
      case 'iOS/Android':
        return { icon: '📱', label: 'スマホ' };
      case 'All':
        return { icon: '🌐', label: 'すべて' };
      default:
        return { icon: '❓', label: 'Unknown' };
    }
  };

  const handleNewSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newQuery = formData.get('q') as string;
    if (newQuery) {
      window.location.href = `/search?q=${encodeURIComponent(newQuery)}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />

      {/* メインコンテンツ */}
      <main className="container mx-auto max-w-6xl px-4 py-8">
        {/* 検索フォーム */}
        <div className="mb-8">
          <form onSubmit={handleNewSearch} className="max-w-3xl mx-auto">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-2xl opacity-20 group-hover:opacity-30 transition-opacity blur-xl"></div>
              <div className="relative flex bg-white rounded-2xl shadow-lg overflow-hidden">
                <input
                  type="text"
                  name="q"
                  defaultValue={query}
                  placeholder="案件名で検索（例：Yahoo!ショッピング）"
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
          </form>
        </div>

        {/* 検索結果 */}
        {query && (
          <div className="animate-slide-in">
            <div className="flex items-center gap-2 mb-6">
              <h2 className="text-2xl font-bold text-gray-900">検索結果</h2>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                「{query}」
              </span>
            </div>

            {/* 過去7日間の最高額 */}
            {maxCashback7Days && (
              <div className="mb-8">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">📈</span>
                    <h3 className="font-semibold text-amber-800">過去7日間の最高額</h3>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-bold text-green-600">{maxCashback7Days.amount}</span>
                    <div className="text-sm text-amber-700">
                      <p className="font-medium">{maxCashback7Days.site}</p>
                      <p>{maxCashback7Days.date}に記録</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">検索中...</p>
                </div>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-600">{results.length}件の案件が見つかりました</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>並び順：還元率の高い順</span>
                  </div>
                </div>

                {/* テーブル表示 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">ポイントサイト</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">還元率</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">案件名</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">対応デバイス</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {results.map((result, index) => {
                          const deviceInfo = getDeviceIcon(result.device);
                          return (
                            <tr key={result.id} className="hover:bg-blue-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <a
                                  href={result.pointSiteUrl || result.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                                >
                                  {result.siteName}
                                </a>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-2xl font-bold text-green-600">{result.cashback}</span>
                              </td>
                              <td className="px-6 py-4">
                                <a
                                  href={result.campaignUrl || result.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-gray-900 hover:text-blue-600 hover:underline transition-colors leading-5"
                                >
                                  {result.description ? result.description.substring(0, 100) + (result.description.length > 100 ? '...' : '') : '案件詳細'}
                                </a>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{deviceInfo.icon}</span>
                                  <span className="text-sm font-medium text-gray-700">{deviceInfo.label}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">検索結果が見つかりませんでした</h3>
                <p className="text-gray-600 mb-6">
                  別のキーワードで検索してみるか、<br />
                  設定ページで検索対象のポイントサイトを確認してください。
                </p>
                <div className="flex gap-4 justify-center">
                  <a
                    href="/settings"
                    className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    設定を確認
                  </a>
                  <a
                    href="/ranking"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    人気キーワード
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* フッター */}
      <footer className="bg-gray-50 mt-20">
        <div className="container mx-auto max-w-6xl px-4 py-12">
          <div className="text-center text-sm text-gray-500">
            <p>© 2025 ポイ速. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchContent />
    </Suspense>
  );
}