'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';

interface Campaign {
  id: string;
  name: string;
  cashback_rate: string;
  campaign_url?: string;
  description?: string;
  device: string;
  category?: string;
  is_active: boolean;
  updated_at: string;
  point_sites: {
    id: string;
    name: string;
    url: string;
  };
}

interface PointSite {
  id: string;
  name: string;
}

export default function CampaignsManagementPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pointSites, setPointSites] = useState<PointSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSite, setSelectedSite] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // 新規作成・編集用
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState({
    point_site_id: '',
    name: '',
    cashback_rate: '',
    campaign_url: '',
    description: '',
    device: 'All',
    category: 'shopping',
    is_active: true
  });

  // CSV一括インポート用
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvData, setCsvData] = useState('');
  const [importResult, setImportResult] = useState<any>(null);

  useEffect(() => {
    fetchCampaigns();
    fetchPointSites();
  }, [searchTerm, selectedSite, showActiveOnly]);

  const fetchCampaigns = async () => {
    try {
      const params = new URLSearchParams({
        search: searchTerm,
        site_id: selectedSite,
        active: showActiveOnly.toString(),
        limit: '100'
      });

      const response = await fetch(`/api/campaigns?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setCampaigns(data.campaigns);
      }
    } catch (error) {
      console.error('案件取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPointSites = async () => {
    try {
      const response = await fetch('/api/point-sites');
      const data = await response.json();
      if (data.success) {
        setPointSites(data.pointSites);
      }
    } catch (error) {
      console.error('ポイントサイト取得エラー:', error);
    }
  };

  const handleCreateCampaign = () => {
    setEditingCampaign(null);
    setFormData({
      point_site_id: '',
      name: '',
      cashback_rate: '',
      campaign_url: '',
      description: '',
      device: 'All',
      category: 'shopping',
      is_active: true
    });
    setIsModalOpen(true);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      point_site_id: campaign.point_sites.id,
      name: campaign.name,
      cashback_rate: campaign.cashback_rate,
      campaign_url: campaign.campaign_url || '',
      description: campaign.description || '',
      device: campaign.device,
      category: campaign.category || 'shopping',
      is_active: campaign.is_active
    });
    setIsModalOpen(true);
  };

  const handleSaveCampaign = async () => {
    try {
      const url = editingCampaign ? '/api/campaigns' : '/api/campaigns';
      const method = editingCampaign ? 'PUT' : 'POST';
      const body = editingCampaign 
        ? { ...formData, id: editingCampaign.id }
        : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SCRAPING_SECRET || 'poisoku-scraping-secret-2024'}`
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      
      if (result.success) {
        setIsModalOpen(false);
        fetchCampaigns();
        alert(editingCampaign ? '案件を更新しました' : '案件を作成しました');
      } else {
        alert(`エラー: ${result.error}`);
      }
    } catch (error) {
      console.error('案件保存エラー:', error);
      alert('保存に失敗しました');
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('この案件を削除しますか？')) return;

    try {
      const response = await fetch(`/api/campaigns?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SCRAPING_SECRET || 'poisoku-scraping-secret-2024'}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        fetchCampaigns();
        alert('案件を削除しました');
      } else {
        alert(`エラー: ${result.error}`);
      }
    } catch (error) {
      console.error('案件削除エラー:', error);
      alert('削除に失敗しました');
    }
  };

  const handleCsvImport = async () => {
    try {
      // CSVを解析
      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const importData = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return {
          siteName: row['サイト名'] || row.siteName,
          campaignName: row['案件名'] || row.campaignName,
          cashbackRate: row['還元率'] || row.cashbackRate,
          campaignUrl: row['案件URL'] || row.campaignUrl,
          description: row['説明'] || row.description,
          device: row['デバイス'] || row.device || 'All',
          category: row['カテゴリ'] || row.category || 'shopping'
        };
      });

      const response = await fetch('/api/campaigns/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SCRAPING_SECRET || 'poisoku-scraping-secret-2024'}`
        },
        body: JSON.stringify({ csvData: importData })
      });

      const result = await response.json();
      setImportResult(result);
      
      if (result.success) {
        fetchCampaigns();
      }
    } catch (error) {
      console.error('CSVインポートエラー:', error);
      setImportResult({
        success: false,
        error: 'インポートに失敗しました'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />

      <main className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">📋 案件管理</h2>
          <p className="text-gray-600">
            ポイントサイトの案件データを管理します。
          </p>
        </div>

        {/* コントロールパネル */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
          <div className="flex flex-wrap gap-4 mb-6">
            {/* 検索 */}
            <input
              type="text"
              placeholder="案件名で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            {/* サイトフィルタ */}
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">すべてのサイト</option>
              {pointSites.map(site => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>

            {/* アクティブフィルタ */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm">アクティブのみ</span>
            </label>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleCreateCampaign}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all duration-200 font-medium"
            >
              新規作成
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg hover:from-green-700 hover:to-green-600 transition-all duration-200 font-medium"
            >
              CSV一括インポート
            </button>
          </div>
        </div>

        {/* 案件リスト */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">
            案件一覧 ({campaigns.length}件)
          </h3>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : campaigns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">案件名</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">ポイントサイト</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">還元率</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">デバイス</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">ステータス</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">更新日</th>
                    <th className="text-center p-4 text-sm font-semibold text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map(campaign => (
                    <tr key={campaign.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <div>
                          <div className="font-medium text-gray-900">{campaign.name}</div>
                          {campaign.description && (
                            <div className="text-sm text-gray-500 mt-1">{campaign.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-600">{campaign.point_sites.name}</td>
                      <td className="p-4">
                        <span className="font-bold text-green-600">{campaign.cashback_rate}</span>
                      </td>
                      <td className="p-4 text-sm text-gray-600">{campaign.device}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          campaign.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {campaign.is_active ? 'アクティブ' : '非アクティブ'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {new Date(campaign.updated_at).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleEditCampaign(campaign)}
                            className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteCampaign(campaign.id)}
                            className="px-3 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              案件が見つかりませんでした
            </div>
          )}
        </div>

        {/* 案件作成・編集モーダル */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                {editingCampaign ? '案件を編集' : '新規案件を作成'}
              </h3>
              
              <div className="space-y-4">
                {/* ポイントサイト選択 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ポイントサイト *
                  </label>
                  <select
                    value={formData.point_site_id}
                    onChange={(e) => setFormData({...formData, point_site_id: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">選択してください</option>
                    {pointSites.map(site => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                </div>

                {/* 案件名 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    案件名 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Yahoo!ショッピング"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* 還元率 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    還元率 *
                  </label>
                  <input
                    type="text"
                    value={formData.cashback_rate}
                    onChange={(e) => setFormData({...formData, cashback_rate: e.target.value})}
                    placeholder="1.0%"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* 案件URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    案件URL
                  </label>
                  <input
                    type="url"
                    value={formData.campaign_url}
                    onChange={(e) => setFormData({...formData, campaign_url: e.target.value})}
                    placeholder="https://example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 説明 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    説明
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="案件の説明"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* デバイス・カテゴリ */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      デバイス
                    </label>
                    <select
                      value={formData.device}
                      onChange={(e) => setFormData({...formData, device: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="All">すべて</option>
                      <option value="PC">PC</option>
                      <option value="iOS">iOS</option>
                      <option value="Android">Android</option>
                      <option value="iOS/Android">スマホ</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      カテゴリ
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="shopping">ショッピング</option>
                      <option value="travel">旅行</option>
                      <option value="finance">金融</option>
                      <option value="entertainment">エンタメ</option>
                      <option value="other">その他</option>
                    </select>
                  </div>
                </div>

                {/* アクティブ */}
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">アクティブ</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveCampaign}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all duration-200 font-medium"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CSV一括インポートモーダル */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-6">CSV一括インポート</h3>
              
              <div className="space-y-6">
                {/* CSVフォーマット説明 */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">CSVフォーマット</h4>
                  <p className="text-sm text-blue-800 mb-3">
                    以下の形式でCSVデータを入力してください：
                  </p>
                  <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
{`サイト名,案件名,還元率,案件URL,説明,デバイス,カテゴリ
ハピタス,Yahoo!ショッピング,1.0%,https://example.com,Yahoo!ショッピングでのお買い物,All,shopping
モッピー,楽天市場,1.0%,https://example.com,楽天市場でのお買い物,All,shopping`}
                  </pre>
                </div>

                {/* CSV入力エリア */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CSVデータ
                  </label>
                  <textarea
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    placeholder="CSVデータをここに貼り付けてください..."
                    rows={10}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>

                {/* インポート結果 */}
                {importResult && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">インポート結果</h4>
                    {importResult.success ? (
                      <div className="text-green-800">
                        <p>✅ {importResult.message}</p>
                        {importResult.results.details.length > 0 && (
                          <div className="mt-2 text-sm">
                            {importResult.results.details.slice(0, 5).map((detail: any, index: number) => (
                              <p key={index}>
                                行{detail.row}: {detail.action === 'imported' ? '新規作成' : '更新'} - {detail.campaign} ({detail.site})
                              </p>
                            ))}
                            {importResult.results.details.length > 5 && (
                              <p>... 他{importResult.results.details.length - 5}件</p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-red-800">❌ エラー: {importResult.error}</p>
                    )}
                    
                    {importResult.results?.errors.length > 0 && (
                      <div className="mt-3 text-red-800">
                        <p className="font-medium">エラー詳細:</p>
                        <div className="text-sm mt-1">
                          {importResult.results.errors.slice(0, 5).map((error: string, index: number) => (
                            <p key={index}>• {error}</p>
                          ))}
                          {importResult.results.errors.length > 5 && (
                            <p>... 他{importResult.results.errors.length - 5}件のエラー</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setCsvData('');
                    setImportResult(null);
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  閉じる
                </button>
                <button
                  onClick={handleCsvImport}
                  disabled={!csvData.trim()}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg hover:from-green-700 hover:to-green-600 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  インポート実行
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}