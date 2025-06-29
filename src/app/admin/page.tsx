'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';

interface ScrapingStats {
  totalScrapings: number;
  successfulScrapings: number;
  totalCampaigns: number;
  averageCampaignsPerScraping: number;
  sitesStats: Array<{
    siteName: string;
    scrapings: number;
    campaigns: number;
    successRate: number;
  }>;
}

export default function AdminPage() {
  const [keyword, setKeyword] = useState('');
  const [selectedSites, setSelectedSites] = useState<string[]>(['ハピタス', 'モッピー']);
  const [isScrapingLoading, setIsScrapingLoading] = useState(false);
  const [scrapingResult, setScrapingResult] = useState<any>(null);
  const [stats, setStats] = useState<ScrapingStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  
  // サイト調査用の状態
  const [investigationKeyword, setInvestigationKeyword] = useState('');
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [investigationResult, setInvestigationResult] = useState<any>(null);

  const availableSites = ['ハピタス', 'モッピー'];

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsStatsLoading(true);
    try {
      const response = await fetch('/api/scrape?days=7');
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('統計取得エラー:', error);
    } finally {
      setIsStatsLoading(false);
    }
  };

  const handleScraping = async () => {
    if (!keyword.trim()) {
      alert('キーワードを入力してください');
      return;
    }

    setIsScrapingLoading(true);
    setScrapingResult(null);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SCRAPING_SECRET || 'poisoku-scraping-secret-2024'}`
        },
        body: JSON.stringify({
          keyword: keyword.trim(),
          sites: selectedSites
        })
      });

      const result = await response.json();
      setScrapingResult(result);
      
      if (result.success) {
        // 統計を再取得
        fetchStats();
      }
    } catch (error) {
      console.error('スクレイピングエラー:', error);
      setScrapingResult({
        success: false,
        error: 'ネットワークエラーが発生しました'
      });
    } finally {
      setIsScrapingLoading(false);
    }
  };

  const handleSiteToggle = (siteName: string) => {
    setSelectedSites(prev => 
      prev.includes(siteName) 
        ? prev.filter(s => s !== siteName)
        : [...prev, siteName]
    );
  };

  // サイト調査を実行
  const handleInvestigation = async () => {
    if (!investigationKeyword.trim()) {
      alert('調査キーワードを入力してください');
      return;
    }

    setIsInvestigating(true);
    setInvestigationResult(null);

    try {
      const response = await fetch('/api/investigate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SCRAPING_SECRET || 'poisoku-scraping-secret-2024'}`
        },
        body: JSON.stringify({
          keyword: investigationKeyword.trim()
        })
      });

      const result = await response.json();
      setInvestigationResult(result);
    } catch (error) {
      console.error('サイト調査エラー:', error);
      setInvestigationResult({
        success: false,
        error: 'ネットワークエラーが発生しました'
      });
    } finally {
      setIsInvestigating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />

      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">🔧 管理画面</h2>
          <p className="text-gray-600">
            スクレイピングの実行とモニタリングを行います。
          </p>
        </div>

        {/* サイト構造調査 */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">🔍 サイト構造調査</h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                調査キーワード
              </label>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={investigationKeyword}
                  onChange={(e) => setInvestigationKeyword(e.target.value)}
                  placeholder="Yahoo、Amazon、楽天など..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleInvestigation}
                  disabled={isInvestigating}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg hover:from-purple-700 hover:to-purple-600 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isInvestigating ? '調査中...' : 'サイト調査'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                ハピタスとモッピーのHTML構造を調査して、適切なセレクタを特定します
              </p>
            </div>

            {/* 調査結果表示 */}
            {investigationResult && (
              <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-4">調査結果</h4>
                
                {investigationResult.success ? (
                  <div className="space-y-6">
                    {/* サマリー */}
                    <div className="grid grid-cols-2 gap-4">
                      {investigationResult.summary.sitesAnalyzed.map((site: any, index: number) => (
                        <div key={index} className="bg-white p-4 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-gray-900">{site.siteName}</h5>
                            <span className={`text-xs px-2 py-1 rounded ${
                              site.containerCandidates > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {site.containerCandidates > 0 ? '構造検出' : '構造不明'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>ページ: {site.pageTitle}</p>
                            <p>候補要素: {site.containerCandidates}個</p>
                            <p>サンプル: {site.sampleElements}個</p>
                            <p>robots.txt: {site.hasRobotsTxt ? '有' : '無'}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 推奨セレクタ */}
                    <div>
                      <h5 className="font-medium text-gray-900 mb-3">推奨セレクタ</h5>
                      <div className="space-y-3">
                        {Object.entries(investigationResult.summary.recommendations).map(([siteName, rec]: [string, any]) => (
                          <div key={siteName} className="bg-white p-4 rounded-lg border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{siteName}</span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                rec.confidence === 'high' ? 'bg-green-100 text-green-800' :
                                rec.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                信頼度: {rec.confidence}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">コンテナ:</span>
                                <code className="block bg-gray-100 p-1 rounded text-xs mt-1">
                                  {rec.containerSelector || '未検出'}
                                </code>
                              </div>
                              <div>
                                <span className="text-gray-500">タイトル:</span>
                                <code className="block bg-gray-100 p-1 rounded text-xs mt-1">
                                  {rec.titleSelector || '未検出'}
                                </code>
                              </div>
                              <div>
                                <span className="text-gray-500">還元率:</span>
                                <code className="block bg-gray-100 p-1 rounded text-xs mt-1">
                                  {rec.cashbackSelector || '未検出'}
                                </code>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* robots.txt情報 */}
                    {investigationResult.detailedAnalyses?.some((a: any) => a.robotsTxt) && (
                      <div>
                        <h5 className="font-medium text-gray-900 mb-3">robots.txt確認</h5>
                        <div className="space-y-2">
                          {investigationResult.detailedAnalyses.map((analysis: any, index: number) => (
                            analysis.robotsTxt && (
                              <details key={index} className="bg-white border rounded-lg">
                                <summary className="p-3 cursor-pointer font-medium">
                                  {analysis.siteName} robots.txt
                                </summary>
                                <pre className="p-3 bg-gray-50 text-xs overflow-auto border-t">
                                  {analysis.robotsTxt}
                                </pre>
                              </details>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-red-600">
                    エラー: {investigationResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 手動スクレイピング */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">手動スクレイピング実行</h3>
          
          <div className="space-y-6">
            {/* キーワード入力 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                検索キーワード
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Yahoo!ショッピング、楽天市場など..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* サイト選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                対象ポイントサイト
              </label>
              <div className="flex gap-4">
                {availableSites.map(site => (
                  <label key={site} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedSites.includes(site)}
                      onChange={() => handleSiteToggle(site)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{site}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 実行ボタン */}
            <button
              onClick={handleScraping}
              disabled={isScrapingLoading || selectedSites.length === 0}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isScrapingLoading ? 'スクレイピング中...' : 'スクレイピング実行'}
            </button>
          </div>

          {/* 結果表示 */}
          {scrapingResult && (
            <div className="mt-8 p-6 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-4">実行結果</h4>
              
              {scrapingResult.success ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-white p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {scrapingResult.totalCampaigns}
                      </div>
                      <div className="text-sm text-gray-600">取得案件数</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {scrapingResult.database.savedCount}
                      </div>
                      <div className="text-sm text-gray-600">新規保存</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {scrapingResult.database.updatedCount}
                      </div>
                      <div className="text-sm text-gray-600">更新</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {scrapingResult.sites.map((site: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white rounded">
                        <span className="font-medium">{site.siteName}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-600">
                            {site.campaignsFound}件取得
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            site.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {site.success ? '成功' : '失敗'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-red-600">
                  エラー: {scrapingResult.error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 統計情報 */}
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">📊 スクレイピング統計（過去7日間）</h3>
            <button
              onClick={fetchStats}
              disabled={isStatsLoading}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {isStatsLoading ? '更新中...' : '更新'}
            </button>
          </div>

          {stats ? (
            <div className="space-y-6">
              {/* 全体統計 */}
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{stats.totalScrapings}</div>
                  <div className="text-sm text-gray-600">総実行回数</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{stats.successfulScrapings}</div>
                  <div className="text-sm text-gray-600">成功回数</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{stats.totalCampaigns}</div>
                  <div className="text-sm text-gray-600">総取得案件</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {stats.averageCampaignsPerScraping.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-600">平均案件数</div>
                </div>
              </div>

              {/* サイト別統計 */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">サイト別統計</h4>
                <div className="space-y-2">
                  {stats.sitesStats.map((site, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <span className="font-medium">{site.siteName}</span>
                      <div className="flex items-center gap-6 text-sm">
                        <span>実行回数: {site.scrapings}</span>
                        <span>取得案件: {site.campaigns}</span>
                        <span className={`px-2 py-1 rounded ${
                          site.successRate >= 80 ? 'bg-green-100 text-green-800' :
                          site.successRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          成功率: {site.successRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              統計データを読み込み中...
            </div>
          )}
        </div>

        {/* 定期実行情報 */}
        <div className="mt-8 bg-blue-50 rounded-2xl p-6">
          <h3 className="font-semibold text-blue-900 mb-3">🤖 自動スクレイピングスケジュール</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="bg-white rounded-lg p-3">
              <div className="font-bold text-blue-600">2:30</div>
              <div className="text-xs text-gray-600">深夜</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="font-bold text-blue-600">8:30</div>
              <div className="text-xs text-gray-600">朝</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="font-bold text-blue-600">14:30</div>
              <div className="text-xs text-gray-600">昼</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="font-bold text-blue-600">20:30</div>
              <div className="text-xs text-gray-600">夜</div>
            </div>
          </div>
          <p className="text-sm text-blue-800 mt-3">
            主要キーワード（Yahoo!ショッピング、楽天市場など）を自動でスクレイピングします。
          </p>
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