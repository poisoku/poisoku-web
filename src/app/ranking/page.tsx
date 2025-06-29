'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';

interface RankingItem {
  rank: number;
  keyword: string;
  searchCount: number;
  topSite?: string;
  topCashback?: string;
  trend: 'up' | 'down' | 'same';
  previousRank?: number;
}

export default function RankingPage() {
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [rankingData, setRankingData] = useState<RankingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRankingData();
  }, []);

  const fetchRankingData = async () => {
    try {
      const response = await fetch('/api/ranking');
      const data = await response.json();
      
      if (response.ok && data.top50) {
        const formattedRanking = data.top50.map((item: any, index: number) => ({
          rank: index + 1,
          keyword: item.keyword,
          searchCount: item.search_count,
          topSite: item.topCampaign?.point_sites?.name || '-',
          topCashback: item.topCampaign?.cashback_rate || '-',
          trend: 'same' as const, // 今後の実装で変動計算を追加
          previousRank: undefined
        }));
        
        setRankingData(formattedRanking);
        setLastUpdated(new Date().toLocaleString('ja-JP'));
      }
    } catch (error) {
      console.error('ランキング取得エラー:', error);
      // フォールバックの仮データ
      setRankingData([
        { rank: 1, keyword: 'Yahoo!ショッピング', searchCount: 150, topSite: 'ハピタス', topCashback: '1.0%', trend: 'same' },
        { rank: 2, keyword: '楽天市場', searchCount: 120, topSite: 'ハピタス', topCashback: '1.0%', trend: 'same' },
        { rank: 3, keyword: 'Amazon', searchCount: 95, topSite: 'モッピー', topCashback: '0.5%', trend: 'same' },
        { rank: 4, keyword: 'じゃらん', searchCount: 80, topSite: 'ハピタス', topCashback: '2.0%', trend: 'same' },
        { rank: 5, keyword: 'ZOZOTOWN', searchCount: 70, topSite: 'ハピタス', topCashback: '1.0%', trend: 'same' }
      ]);
      setLastUpdated(new Date().toLocaleString('ja-JP'));
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'same', previousRank?: number, currentRank?: number) => {
    if (trend === 'up' && previousRank && currentRank) {
      const diff = previousRank - currentRank;
      return <span className="text-red-500">↑{diff > 0 ? diff : ''}</span>;
    } else if (trend === 'down' && previousRank && currentRank) {
      const diff = currentRank - previousRank;
      return <span className="text-blue-500">↓{diff > 0 ? diff : ''}</span>;
    }
    return <span className="text-gray-400">→</span>;
  };

  const getNextUpdateTime = () => {
    const now = new Date();
    const nextHours = [0, 6, 12, 18];
    const currentHour = now.getHours();
    
    let nextHour = nextHours.find(h => h > currentHour);
    if (!nextHour) {
      nextHour = nextHours[0]; // 次の日の0時
    }
    
    const nextUpdate = new Date(now);
    if (nextHour === 0 && currentHour >= 18) {
      nextUpdate.setDate(nextUpdate.getDate() + 1);
    }
    nextUpdate.setHours(nextHour, 1, 0, 0);
    
    return nextUpdate.toLocaleString('ja-JP', { 
      month: 'numeric', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />

      {/* メインコンテンツ */}
      <main className="container mx-auto max-w-6xl px-4 py-8">
        {/* ランキングコンテンツ */}
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">🔥 検索ランキング TOP50</h2>
            <div className="text-right">
              <p className="text-sm text-gray-600">最終更新: {lastUpdated}</p>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">ランキングを読み込み中...</p>
            </div>
          ) : (
            /* ランキングテーブル */
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">順位</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">検索キーワード</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">最高還元</th>
                    <th className="text-right p-4 text-sm font-semibold text-gray-700">検索数</th>
                    <th className="text-center p-4 text-sm font-semibold text-gray-700">変動</th>
                  </tr>
                </thead>
                <tbody>
                  {rankingData.map((item, index) => (
                    <tr key={item.rank} className={`border-b hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}`}>
                      <td className="p-4">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                          ${item.rank <= 3 ? 'bg-gradient-to-br from-yellow-400 to-orange-400 text-white' : 'bg-gray-100 text-gray-600'}
                        `}>
                          {item.rank}
                        </div>
                      </td>
                      <td className="p-4">
                        <a
                          href={`/search?q=${encodeURIComponent(item.keyword)}`}
                          className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                        >
                          {item.keyword}
                        </a>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          <span className="font-bold text-green-600">{item.topCashback || '-'}</span>
                          {item.topSite && (
                            <div className="text-xs text-gray-500 mt-0.5">{item.topSite}</div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right text-gray-700 font-medium">{item.searchCount.toLocaleString()}</td>
                      <td className="p-4 text-center font-medium">
                        {getTrendIcon(item.trend, item.previousRank, item.rank)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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