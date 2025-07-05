const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

class SearchAPITester {
  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // 検索API ロジックのテスト（APIルートと同じロジック）
  async testSearch(params = {}) {
    const {
      keyword = '',
      category = '',
      device = '',
      sort = 'name',
      order = 'asc',
      page = 1,
      limit = 20,
      site = ''
    } = params;

    console.log(`🔍 テスト実行: ${JSON.stringify(params)}`);

    try {
      // ページングの計算
      const pageNum = Math.max(1, parseInt(page));
      const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * pageSize;

      // ベースクエリの構築
      let query = this.supabase
        .from('campaigns')
        .select(`
          id,
          name,
          cashback_rate,
          device,
          campaign_url,
          description,
          category,
          is_active,
          created_at,
          updated_at,
          point_sites (
            id,
            name,
            url
          )
        `, { count: 'exact' })
        .eq('is_active', true);

      // キーワード検索
      if (keyword) {
        query = query.or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%`);
      }

      // カテゴリフィルター
      if (category) {
        query = query.eq('category', category);
      }

      // デバイスフィルター
      if (device) {
        query = query.eq('device', device);
      }

      // ポイントサイトフィルター
      if (site) {
        const { data: siteData } = await this.supabase
          .from('point_sites')
          .select('id')
          .ilike('name', `%${site}%`);
        
        if (siteData && siteData.length > 0) {
          const siteIds = siteData.map(s => s.id);
          query = query.in('point_site_id', siteIds);
        } else {
          return {
            campaigns: [],
            total: 0,
            page: pageNum,
            limit: pageSize,
            totalPages: 0,
            message: '該当サイトが見つかりません'
          };
        }
      }

      // ソート
      const validSortColumns = ['name', 'created_at', 'updated_at', 'category'];
      const sortColumn = validSortColumns.includes(sort) ? sort : 'name';
      const sortOrder = order === 'desc' ? false : true;
      
      query = query.order(sortColumn, { ascending: sortOrder });

      // ページング
      query = query.range(offset, offset + pageSize - 1);

      // クエリ実行
      const { data: campaigns, count, error } = await query;

      if (error) {
        console.error('❌ 検索エラー:', error);
        return { error: error.message };
      }

      // レスポンス
      const totalPages = Math.ceil(count / pageSize);

      const result = {
        campaigns: campaigns || [],
        total: count || 0,
        page: pageNum,
        limit: pageSize,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      };

      console.log(`✅ 成功: ${result.total}件中 ${result.campaigns.length}件を取得`);
      return result;

    } catch (error) {
      console.error('💥 テストエラー:', error);
      return { error: error.message };
    }
  }

  async runAllTests() {
    console.log('🧪 検索機能テスト開始');
    console.log('='.repeat(60));

    const tests = [
      {
        name: '基本検索（全件取得）',
        params: { limit: 5 }
      },
      {
        name: 'キーワード検索（ショップ）',
        params: { keyword: 'ショップ', limit: 3 }
      },
      {
        name: 'キーワード検索（アプリ）',
        params: { keyword: 'アプリ', limit: 3 }
      },
      {
        name: 'カテゴリフィルタ（shopping）',
        params: { category: 'shopping', limit: 3 }
      },
      {
        name: 'カテゴリフィルタ（finance）',
        params: { category: 'finance', limit: 3 }
      },
      {
        name: 'サイトフィルタ（ちょびリッチ）',
        params: { site: 'ちょびリッチ', limit: 3 }
      },
      {
        name: 'ページング（2ページ目）',
        params: { page: 2, limit: 2 }
      },
      {
        name: 'ソート（作成日降順）',
        params: { sort: 'created_at', order: 'desc', limit: 3 }
      },
      {
        name: '複合検索（ショップ + shopping）',
        params: { keyword: 'ショップ', category: 'shopping', limit: 2 }
      }
    ];

    for (const test of tests) {
      console.log(`\n📋 ${test.name}`);
      console.log('-'.repeat(40));
      
      const result = await this.testSearch(test.params);
      
      if (result.error) {
        console.log(`❌ エラー: ${result.error}`);
      } else {
        console.log(`✅ 成功 - 総件数: ${result.total}件, 表示: ${result.campaigns.length}件`);
        console.log(`📄 ページ: ${result.page}/${result.totalPages}`);
        
        if (result.campaigns.length > 0) {
          console.log('🎯 サンプル案件:');
          result.campaigns.slice(0, 2).forEach((campaign, i) => {
            console.log(`   ${i+1}. ${campaign.name}`);
            console.log(`      カテゴリ: ${campaign.category}, デバイス: ${campaign.device}`);
            console.log(`      還元: ${campaign.cashback_rate}`);
          });
        }
      }
      
      // 少し待機
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 全テスト完了');
    
    // 統計情報を表示
    await this.showStatistics();
  }

  async showStatistics() {
    console.log('\n📊 データベース統計情報');
    console.log('='.repeat(60));

    try {
      // 総キャンペーン数
      const { count: totalCampaigns } = await this.supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      console.log(`📈 有効キャンペーン総数: ${totalCampaigns}件`);

      // カテゴリ別統計
      const { data: categoryStats } = await this.supabase
        .from('campaigns')
        .select('category')
        .eq('is_active', true);
      
      if (categoryStats) {
        const categoryCounts = {};
        categoryStats.forEach(item => {
          categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
        });
        
        console.log('\n📋 カテゴリ別統計:');
        Object.entries(categoryCounts).forEach(([category, count]) => {
          console.log(`   ${category}: ${count}件`);
        });
      }

      // デバイス別統計
      const { data: deviceStats } = await this.supabase
        .from('campaigns')
        .select('device')
        .eq('is_active', true);
      
      if (deviceStats) {
        const deviceCounts = {};
        deviceStats.forEach(item => {
          deviceCounts[item.device] = (deviceCounts[item.device] || 0) + 1;
        });
        
        console.log('\n📱 デバイス別統計:');
        Object.entries(deviceCounts).forEach(([device, count]) => {
          console.log(`   ${device}: ${count}件`);
        });
      }

      // ポイントサイト別統計
      const { data: pointSiteStats } = await this.supabase
        .from('campaigns')
        .select(`
          point_site_id,
          point_sites (
            name
          )
        `)
        .eq('is_active', true);
      
      if (pointSiteStats) {
        const siteCounts = {};
        pointSiteStats.forEach(item => {
          const siteName = item.point_sites?.name || 'Unknown';
          siteCounts[siteName] = (siteCounts[siteName] || 0) + 1;
        });
        
        console.log('\n🏪 ポイントサイト別統計:');
        Object.entries(siteCounts).forEach(([site, count]) => {
          console.log(`   ${site}: ${count}件`);
        });
      }

    } catch (error) {
      console.error('統計情報取得エラー:', error);
    }
  }
}

// テスト実行
(async () => {
  const tester = new SearchAPITester();
  await tester.runAllTests();
})();