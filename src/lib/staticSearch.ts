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

let searchDataCache: SearchData | null = null;

export async function loadSearchData(bustCache: boolean = false): Promise<SearchData> {
  if (searchDataCache && !bustCache) {
    return searchDataCache;
  }

  try {
    // キャッシュバスターを追加してブラウザキャッシュを回避
    const cacheBuster = bustCache ? `?_cb=${Date.now()}` : '';
    const response = await fetch(`/search-data.json${cacheBuster}`, {
      cache: bustCache ? 'no-store' : 'default',
      headers: bustCache ? {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      } : {}
    });
    
    if (!response.ok) {
      throw new Error('検索データの読み込みに失敗しました');
    }
    
    searchDataCache = await response.json();
    return searchDataCache!;
  } catch (error) {
    console.error('検索データ読み込みエラー:', error);
    
    // フォールバックとして空のデータを返す
    return {
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
  }
}

export interface SearchOptions {
  keyword?: string;
  osFilter?: 'all' | 'ios' | 'android' | 'pc';
  category?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'cashback' | 'updated' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export async function searchCampaigns(options: SearchOptions & { bustCache?: boolean } = {}) {
  const {
    keyword = '',
    osFilter = 'all',
    category = '',
    limit = 50,
    offset = 0,
    sortBy = 'relevance',
    sortOrder = 'desc',
    bustCache = false
  } = options;

  const searchData = await loadSearchData(bustCache);
  let results = [...searchData.campaigns];

  // 無効な還元率の案件を除外
  results = results.filter(campaign => {
    const cashback = campaign.cashback || '';
    const cashbackYen = campaign.cashbackYen || '';
    
    // 除外パターン
    const invalidPatterns = [
      '要確認',
      '不明',
      'なし',
      '未定',
      'TBD',
      '確認中'
    ];
    
    return !invalidPatterns.some(pattern => 
      cashback.includes(pattern) || cashbackYen.includes(pattern)
    );
  });

  // キーワード検索
  if (keyword && keyword.trim().length > 0) {
    const searchTerms = keyword.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    
    results = results.filter(campaign => {
      // 名前と説明でキーワード検索
      const searchText = `${campaign.description} ${campaign.siteName}`.toLowerCase();
      
      return searchTerms.every(term => 
        searchText.includes(term) || campaign.searchKeywords.includes(term)
      );
    });

    // 関連度でスコア計算
    results = results.map(campaign => {
      let relevanceScore = campaign.searchWeight;
      const searchText = `${campaign.description} ${campaign.siteName}`.toLowerCase();
      
      searchTerms.forEach(term => {
        // 完全一致ボーナス
        if (searchText.includes(term)) {
          relevanceScore += 2;
        }
        
        // タイトルに含まれている場合のボーナス
        if (campaign.description.toLowerCase().includes(term)) {
          relevanceScore += 1;
        }
        
        // サイト名に含まれている場合のボーナス
        if (campaign.siteName.toLowerCase().includes(term)) {
          relevanceScore += 0.5;
        }
      });
      
      return {
        ...campaign,
        relevanceScore
      };
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
        // パーセント案件を優先し、その後数値でソート
        const aIsPercent = (a.cashback || '').includes('%');
        const bIsPercent = (b.cashback || '').includes('%');
        
        if (aIsPercent && !bIsPercent) {
          // aが%、bが円の場合、aを優先
          return sortOrder === 'desc' ? -1 : 1;
        } else if (!aIsPercent && bIsPercent) {
          // aが円、bが%の場合、bを優先
          return sortOrder === 'desc' ? 1 : -1;
        } else {
          // 両方が同じタイプの場合は数値比較
          aValue = extractNumericValue(a.cashbackYen || a.cashback);
          bValue = extractNumericValue(b.cashbackYen || b.cashback);
          
          if (sortOrder === 'asc') {
            return aValue > bValue ? 1 : -1;
          } else {
            return aValue < bValue ? 1 : -1;
          }
        }
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
    
    // cashback以外の場合の標準ソート
    if (sortBy !== 'cashback') {
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    }
  });

  // ページング
  const totalCount = results.length;
  const paginatedResults = results.slice(offset, offset + limit);

  return {
    success: true,
    data: {
      results: paginatedResults,
      maxCashback7Days: searchData.metadata.maxCashbackData,
      totalCount,
      hasMore: offset + limit < totalCount,
      filters: {
        keyword,
        osFilter,
        category,
        limit,
        offset,
        sortBy,
        sortOrder
      },
      metadata: searchData.metadata
    }
  };
}

// 還元率から数値を抽出（円換算値とポイント値の両方に対応）
function extractNumericValue(cashback: string): number {
  // カンマ区切りの数値にも対応（例：99,905円）
  const match = cashback.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/);
  if (match) {
    // カンマを除去して数値に変換
    return parseFloat(match[1].replace(/,/g, ''));
  }
  return 0;
}

export async function getPopularKeywords(): Promise<Array<{keyword: string; count: number}>> {
  const searchData = await loadSearchData();
  return searchData.metadata.popularKeywords;
}

export async function getCategoryStats(): Promise<Record<string, number>> {
  const searchData = await loadSearchData();
  return searchData.metadata.categories;
}

export async function getDeviceStats(): Promise<Record<string, number>> {
  const searchData = await loadSearchData();
  return searchData.metadata.devices;
}