/**
 * クライアントサイド専用検索機能
 * 静的サイト生成環境でも確実に動作
 */

interface SearchResult {
  id: string;
  siteName: string;
  cashback: string;
  cashbackYen?: string;
  device: 'PC' | 'iOS' | 'Android' | 'All' | 'iOS/Android';
  url: string;
  lastUpdated: string;
  description?: string;
  displayName?: string;
  campaignUrl?: string;
  pointSiteUrl?: string;
  category: string;
  searchKeywords: string;
  searchWeight: number;
}

interface SearchData {
  campaigns: SearchResult[];
  metadata: {
    totalCampaigns: number;
    lastUpdated: string;
    categories: Record<string, number>;
    devices: Record<string, number>;
    sites: Record<string, number>;
    maxCashbackData?: {
      amount: string;
      site: string;
      campaignName: string;
      date: string;
    };
    popularKeywords: Array<{
      keyword: string;
      count: number;
    }>;
  };
}

interface SearchOptions {
  keyword?: string;
  osFilter?: 'all' | 'ios' | 'android' | 'pc';
  category?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'cashback' | 'updated' | 'name';
  sortOrder?: 'asc' | 'desc';
}

let searchDataCache: SearchData | null = null;
let loadingPromise: Promise<SearchData> | null = null;

/**
 * 検索データをクライアントサイドで安全に読み込み
 */
async function loadSearchData(): Promise<SearchData> {
  // 既にロード中の場合は同じPromiseを返す
  if (loadingPromise) {
    return loadingPromise;
  }
  
  // キャッシュがある場合はそれを返す
  if (searchDataCache) {
    return searchDataCache;
  }

  // 新しいロードを開始
  loadingPromise = (async (): Promise<SearchData> => {
    try {
      console.log('🔍 検索データ読み込み開始...');
      
      // 複数の方法でデータ取得を試行（静的サイト対応）
      const attempts = [
        // 方法1: 通常のfetch
        () => fetch('/search-data.json', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        }),
        // 方法2: キャッシュバスター付きfetch
        () => fetch(`/search-data.json?_cb=${Date.now()}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        }),
        // 方法3: 異なるパスでの試行
        () => fetch(`./search-data.json?t=${Math.random()}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-store'
          }
        })
      ];

      let lastError: Error | null = null;
      
      for (let i = 0; i < attempts.length; i++) {
        try {
          console.log(`📡 データ取得試行 ${i + 1}/${attempts.length}`);
          
          const response = await attempts[i]();
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          // データの妥当性チェック
          if (!data.campaigns || !Array.isArray(data.campaigns)) {
            throw new Error('Invalid data format: campaigns not found');
          }
          
          console.log(`✅ データ取得成功: ${data.campaigns.length}件`);
          
          // metadataが存在しない場合は空のmetadataを作成
          if (!data.metadata) {
            console.log('⚠️ metadataが存在しないため、デフォルトを生成');
            data.metadata = {
              totalCampaigns: data.campaigns.length,
              lastUpdated: new Date().toISOString(),
              categories: {},
              devices: {},
              sites: {},
              popularKeywords: []
            };
          }
          
          searchDataCache = data;
          loadingPromise = null; // 成功したのでPromiseをクリア
          
          return data;
          
        } catch (error) {
          console.warn(`❌ 試行 ${i + 1} 失敗:`, error);
          lastError = error as Error;
          
          // 少し待ってから次を試行
          if (i < attempts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // すべての試行が失敗した場合
      throw new Error(`All data loading attempts failed. Last error: ${lastError?.message}`);
      
    } catch (error) {
      console.error('💥 データ読み込み完全失敗:', error);
      loadingPromise = null; // エラー時もPromiseをクリア
      
      // フォールバックとして最小限のデータを返す
      const fallbackData: SearchData = {
        campaigns: [],
        metadata: {
          totalCampaigns: 0,
          lastUpdated: new Date().toISOString(),
          categories: {},
          devices: {},
          sites: {},
          popularKeywords: []
        }
      };
      
      return fallbackData;
    }
  })();

  return loadingPromise;
}

/**
 * クライアントサイド検索の実行
 */
export async function clientSearch(options: SearchOptions = {}) {
  const {
    keyword = '',
    osFilter = 'all',
    category = '',
    limit = 50,
    offset = 0,
    sortBy = 'relevance',
    sortOrder = 'desc'
  } = options;

  try {
    console.log('🔍 クライアントサイド検索開始:', { keyword, osFilter });
    
    const searchData = await loadSearchData();
    let results = [...searchData.campaigns];

    console.log(`📊 読み込み完了: ${results.length}件`);

    // 無効な還元率の案件を除外
    results = results.filter(campaign => {
      const cashback = campaign.cashback || '';
      const cashbackYen = campaign.cashbackYen || '';
      
      const invalidPatterns = [
        '要確認', '不明', 'なし', '未定', 'TBD', '確認中'
      ];
      
      return !invalidPatterns.some(pattern => 
        cashback.includes(pattern) || cashbackYen.includes(pattern)
      );
    });

    // キーワード検索
    if (keyword && keyword.trim().length > 0) {
      const searchTerms = keyword.toLowerCase().split(/\s+/).filter(term => term.length > 0);
      
      results = results.filter(campaign => {
        const searchText = `${campaign.description} ${campaign.siteName}`.toLowerCase();
        
        return searchTerms.every(term => 
          searchText.includes(term) || campaign.searchKeywords.includes(term)
        );
      });

      // 関連度スコア計算
      results = results.map(campaign => {
        let relevanceScore = campaign.searchWeight;
        const searchText = `${campaign.description} ${campaign.siteName}`.toLowerCase();
        
        searchTerms.forEach(term => {
          if (searchText.includes(term)) relevanceScore += 2;
          if (campaign.description.toLowerCase().includes(term)) relevanceScore += 1;
          if (campaign.siteName.toLowerCase().includes(term)) relevanceScore += 0.5;
        });
        
        return { ...campaign, relevanceScore };
      });
    }

    // OSフィルタリング
    if (osFilter !== 'all') {
      results = results.filter(campaign => {
        switch (osFilter) {
          case 'ios':
            return ['iOS', 'iOS/Android', 'All'].includes(campaign.device);
          case 'android':
            return ['Android', 'iOS/Android', 'All'].includes(campaign.device);
          case 'pc':
            return ['PC', 'All'].includes(campaign.device);
          default:
            return true;
        }
      });
    }

    // カテゴリフィルタリング
    if (category) {
      results = results.filter(campaign => campaign.category === category);
    }

    // ソート
    results.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'relevance':
          aValue = (a as any).relevanceScore || a.searchWeight;
          bValue = (b as any).relevanceScore || b.searchWeight;
          break;
        case 'cashback':
          aValue = extractNumericValue(a.cashbackYen || a.cashback);
          bValue = extractNumericValue(b.cashbackYen || b.cashback);
          break;
        case 'updated':
          aValue = new Date(a.lastUpdated).getTime();
          bValue = new Date(b.lastUpdated).getTime();
          break;
        case 'name':
          aValue = a.description;
          bValue = b.description;
          break;
        default:
          aValue = a.searchWeight;
          bValue = b.searchWeight;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // ページング
    const totalCount = results.length;
    const paginatedResults = results.slice(offset, offset + limit);

    console.log(`✅ 検索完了: ${paginatedResults.length}件/${totalCount}件`);

    return {
      success: true,
      data: {
        results: paginatedResults,
        maxCashback7Days: searchData.metadata?.maxCashbackData || null,
        totalCount,
        hasMore: offset + limit < totalCount,
        filters: { keyword, osFilter, category, limit, offset, sortBy, sortOrder },
        metadata: searchData.metadata
      }
    };

  } catch (error) {
    console.error('💥 クライアントサイド検索エラー:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {
        results: [],
        totalCount: 0,
        hasMore: false,
        filters: { keyword, osFilter, category, limit, offset, sortBy, sortOrder },
        metadata: {}
      }
    };
  }
}

// 還元率から数値を抽出
function extractNumericValue(cashback: string): number {
  const match = cashback.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }
  return 0;
}