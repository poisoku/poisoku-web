'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';

interface PointSite {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
  category: 'major' | 'gaming' | 'survey' | 'cashback';
}


export default function SettingsPage() {
  const [pointSites, setPointSites] = useState<PointSite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    fetchPointSites();
  }, []);

  const fetchPointSites = async () => {
    try {
      const response = await fetch('/api/point-sites');
      const data = await response.json();
      
      // ローカルストレージから設定を読み込み
      const savedSettings = localStorage.getItem('pointSiteSettings');
      let enabledSites: { [key: string]: boolean } = {};
      
      if (savedSettings) {
        try {
          enabledSites = JSON.parse(savedSettings);
        } catch (error) {
          console.error('設定の読み込みに失敗しました:', error);
        }
      }
      
      // APIから取得したデータに設定を適用
      const sitesWithSettings = data.map((site: any) => ({
        id: site.id,
        name: site.name,
        enabled: enabledSites[site.id] !== undefined ? enabledSites[site.id] : true,
        description: site.description,
        category: site.category
      }));
      
      setPointSites(sitesWithSettings);
    } catch (error) {
      console.error('ポイントサイトの取得に失敗しました:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSite = (siteId: string) => {
    setPointSites(sites =>
      sites.map(site =>
        site.id === siteId ? { ...site, enabled: !site.enabled } : site
      )
    );
  };

  const handleSelectAll = () => {
    setPointSites(sites => sites.map(site => ({ ...site, enabled: true })));
  };

  const handleDeselectAll = () => {
    setPointSites(sites => sites.map(site => ({ ...site, enabled: false })));
  };


  const handleSaveSettings = () => {
    // IDと有効/無効の状態のみを保存
    const settingsToSave: { [key: string]: boolean } = {};
    pointSites.forEach(site => {
      settingsToSave[site.id] = site.enabled;
    });
    
    localStorage.setItem('pointSiteSettings', JSON.stringify(settingsToSave));
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 3000);
  };

  const filteredSites = pointSites.filter(site => {
    return site.name.toLowerCase().includes(searchTerm.toLowerCase());
  });


  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />

      {/* メインコンテンツ */}
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-600 mb-2">検索対象ポイントサイト設定</h2>
          <p className="text-gray-600">
            検索結果に表示するポイントサイトを選択してください。チェックを外したサイトは検索結果から除外されます。
          </p>
        </div>


        {/* コントロールパネル */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
          <div className="mb-6">
            {/* 検索フィルター */}
            <input
              type="text"
              placeholder="サイト名で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 一括操作ボタン */}
          <div className="flex gap-3">
            <button
              onClick={handleSelectAll}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              すべて選択
            </button>
            <button
              onClick={handleDeselectAll}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              すべて解除
            </button>
          </div>
        </div>

        {/* ポイントサイトリスト */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {filteredSites.map(site => (
              <label
                key={site.id}
                className="flex items-start gap-4 p-4 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors border border-gray-100 hover:border-blue-200"
              >
                <input
                  type="checkbox"
                  checked={site.enabled}
                  onChange={() => handleToggleSite(site.id)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 mt-1"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-600">{site.name}</span>
                </div>
              </label>
              ))}
            </div>
          )}

          {!isLoading && filteredSites.length === 0 && (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🔍</div>
              <p className="text-gray-600">該当するポイントサイトが見つかりません</p>
            </div>
          )}
        </div>

        {/* 保存ボタン */}
        <div className="text-center">
          <button
            onClick={handleSaveSettings}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all duration-200 font-medium text-lg shadow-lg"
          >
            設定を保存
          </button>
          {showSaved && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg animate-slide-in">
              <p className="text-green-800 font-medium">✅ 設定を保存しました</p>
            </div>
          )}
        </div>

        {/* 注意事項 */}
        <div className="mt-12 bg-blue-50 rounded-2xl p-6">
          <h3 className="font-semibold text-blue-900 mb-3">💡 設定について</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• 設定はブラウザのローカルストレージに保存されます</li>
            <li>• ブラウザのキャッシュをクリアすると設定がリセットされます</li>
            <li>• 少なくとも1つのポイントサイトは選択することをおすすめします</li>
            <li>• 設定は検索結果にリアルタイムで反映されます</li>
          </ul>
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