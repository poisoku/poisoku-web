import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface SearchOptions {
  keyword?: string;
  osFilter?: 'all' | 'ios' | 'android' | 'pc';
  category?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'cashback' | 'updated' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // パラメータの取得
    const options: SearchOptions = {
      keyword: searchParams.get('q') || '',
      osFilter: (searchParams.get('os') as any) || 'all',
      category: searchParams.get('category') || '',
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
      sortBy: (searchParams.get('sortBy') as any) || 'relevance',
      sortOrder: (searchParams.get('sortOrder') as any) || 'desc'
    };

    // 検索データの読み込み
    const searchDataPath = path.join(process.cwd(), 'public', 'search-data.json');
    const searchDataContent = fs.readFileSync(searchDataPath, 'utf-8');
    const searchData = JSON.parse(searchDataContent);

    let results = [...searchData.campaigns];

    // 無効な還元率の案件を除外
    results = results.filter((campaign: any) => {
      const cashback = campaign.cashback || '';
      const cashbackYen = campaign.cashbackYen || '';
      
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
    if (options.keyword && options.keyword.trim().length > 0) {
      const searchTerms = options.keyword.toLowerCase().split(/\s+/).filter(term => term.length > 0);
      
      results = results.filter((campaign: any) => {
        const searchText = `${campaign.description} ${campaign.siteName}`.toLowerCase();
        
        return searchTerms.every(term => 
          searchText.includes(term) || campaign.searchKeywords.includes(term)
        );
      });

      // 関連度でスコア計算
      results = results.map((campaign: any) => {
        let relevanceScore = campaign.searchWeight;
        const searchText = `${campaign.description} ${campaign.siteName}`.toLowerCase();
        
        searchTerms.forEach(term => {
          if (searchText.includes(term)) {
            relevanceScore += 2;
          }
          
          if (campaign.description.toLowerCase().includes(term)) {
            relevanceScore += 1;
          }
          
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
    if (options.osFilter !== 'all') {
      results = results.filter((campaign: any) => {
        switch (options.osFilter) {
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
    if (options.category) {
      results = results.filter((campaign: any) => campaign.category === options.category);
    }

    // ソート
    results.sort((a: any, b: any) => {
      let aValue: any, bValue: any;
      
      switch (options.sortBy) {
        case 'relevance':
          aValue = a.relevanceScore || a.searchWeight;
          bValue = b.relevanceScore || b.searchWeight;
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
      
      if (options.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // ページング
    const totalCount = results.length;
    const paginatedResults = results.slice(options.offset, options.offset + options.limit);

    return NextResponse.json({
      success: true,
      data: {
        results: paginatedResults,
        maxCashback7Days: searchData.metadata?.maxCashbackData,
        totalCount,
        hasMore: options.offset + options.limit < totalCount,
        filters: options,
        metadata: searchData.metadata
      }
    });

  } catch (error) {
    console.error('検索API エラー:', error);
    
    return NextResponse.json({
      success: false,
      error: 'データの取得に失敗しました',
      data: {
        results: [],
        totalCount: 0,
        hasMore: false,
        filters: {},
        metadata: {}
      }
    }, { status: 500 });
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