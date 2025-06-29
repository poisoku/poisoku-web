import Link from 'next/link';

type CategoryInfo = {
  name: string;
  icon: string;
  description: string;
};

type Campaign = {
  id: string;
  name: string;
  cashback_rate: string;
  point_site: string;
  campaign_url: string;
  search_count?: number;
};

const categoryMap: Record<string, CategoryInfo> = {
  shopping: {
    name: 'ショッピング',
    icon: '🛍️',
    description: 'オンラインショッピング・EC・マーケットプレイス関連の案件'
  },
  travel: {
    name: '旅行',
    icon: '✈️',
    description: '旅行予約・ホテル・航空券・ツアー関連の案件'
  },
  app: {
    name: 'アプリ',
    icon: '📱',
    description: 'スマートフォンアプリ・ゲーム・サービス関連の案件'
  },
  creditcard: {
    name: 'クレカ',
    icon: '💳',
    description: 'クレジットカード・デビットカード・プリペイドカード関連の案件'
  },
  money: {
    name: 'マネー',
    icon: '💰',
    description: '証券・FX・仮想通貨・投資・金融サービス関連の案件'
  },
  entertainment: {
    name: 'エンタメ',
    icon: '🎬',
    description: '動画配信・音楽・電子書籍・エンタメサービス関連の案件'
  }
};

// モックデータ
const mockCampaigns = [
  { id: '1', name: 'Yahoo!ショッピング', cashback_rate: '1.0%', point_site: 'ハピタス', campaign_url: '#', search_count: 150 },
  { id: '2', name: '楽天市場', cashback_rate: '1.0%', point_site: 'ハピタス', campaign_url: '#', search_count: 120 },
  { id: '3', name: 'Amazon', cashback_rate: '0.5%', point_site: 'モッピー', campaign_url: '#', search_count: 95 },
  { id: '4', name: 'じゃらん', cashback_rate: '2.0%', point_site: 'ハピタス', campaign_url: '#', search_count: 80 },
  { id: '5', name: 'ZOZOTOWN', cashback_rate: '1.0%', point_site: 'ハピタス', campaign_url: '#', search_count: 70 },
];

export async function generateStaticParams() {
  return [
    { slug: 'shopping' },
    { slug: 'travel' },
    { slug: 'app' },
    { slug: 'creditcard' },
    { slug: 'money' },
    { slug: 'entertainment' },
  ];
}

export default function CategoryRankingPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const category = categoryMap[slug];

  if (!category) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto max-w-6xl px-4 py-16">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-600 mb-4">カテゴリーが見つかりません</h1>
            <Link href="/" className="text-blue-600 hover:text-blue-700">
              トップページに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* ヘッダー */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                ポイ速
              </h1>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className="text-gray-600 hover:text-blue-600 transition-colors text-sm font-medium">
                トップ
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

      <main className="container mx-auto max-w-6xl px-4 py-8">
        {/* カテゴリーヘッダー */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center text-3xl">
              {category.icon}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-600">{category.name}カテゴリー</h1>
              <p className="text-gray-600 mt-1">{category.description}</p>
            </div>
          </div>
        </div>

        {/* ランキング表示 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-blue-50 px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-blue-600">💰 最高還元率ランキング</h2>
          </div>
          
          <div className="p-6">
            <div className="space-y-4">
              {mockCampaigns.map((campaign, index) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`
                        w-12 h-12 rounded-full flex items-center justify-center font-bold
                        ${index < 3 ? 'bg-gradient-to-br from-yellow-400 to-orange-400 text-white' : 'bg-gray-100 text-gray-600'}
                      `}>
                        {index + 1}
                      </div>
                      <div>
                        <a
                          href={campaign.campaign_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-gray-600 hover:text-blue-600 transition-colors"
                        >
                          {campaign.name}
                        </a>
                        <div className="text-sm text-gray-500 mt-1">
                          {campaign.point_site}
                          {campaign.search_count && (
                            <span className="ml-2">• {campaign.search_count}回検索</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">{campaign.cashback_rate}</p>
                      <p className="text-xs text-gray-500">還元率</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}