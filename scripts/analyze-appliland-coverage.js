const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

class ApplilandAnalyzer {
  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async analyzeApplilandCoverage() {
    console.log('🔍 アプリランド案件の網羅状況を分析中...');
    console.log('='.repeat(70));

    // 1. データベース内のアプリランド案件を確認
    console.log('📊 データベース内のアプリランド案件:');
    const { data: dbAppliland, error: dbError } = await this.supabase
      .from('campaigns')
      .select('*')
      .ilike('name', '%アプリランド%')
      .eq('is_active', true);

    if (dbError) {
      console.error('❌ データベースエラー:', dbError);
      return;
    }

    console.log(`   総数: ${dbAppliland?.length || 0}件`);
    if (dbAppliland && dbAppliland.length > 0) {
      dbAppliland.forEach((campaign, index) => {
        console.log(`   ${index + 1}. ${campaign.name.substring(0, 50)}...`);
        console.log(`      還元率: ${campaign.cashback_rate}`);
        console.log(`      URL: ${campaign.campaign_url}`);
      });
    }

    // 2. ファイル内のアプリランド案件を分析
    console.log('\n📋 ファイル内で発見されたアプリランド案件:');
    
    try {
      // missing campaigns ファイルから分析
      const missingData = await fs.readFile('/Users/kn/poisoku-web/chobirich_missing_campaigns.json', 'utf8');
      const missing = JSON.parse(missingData);
      
      const missingAppliland = missing.campaigns?.filter(c => 
        c.title?.includes('アプリランド') || c.fullText?.includes('アプリランド')
      ) || [];
      
      console.log(`   Missing campaigns: ${missingAppliland.length}件`);
      missingAppliland.slice(0, 10).forEach((campaign, index) => {
        console.log(`   ${index + 1}. ${campaign.title?.substring(0, 50)}...`);
      });

      // 他のファイルも確認
      const unifiedData = await fs.readFile('/Users/kn/poisoku-web/chobirich_unified_medium_results.json', 'utf8');
      const unified = JSON.parse(unifiedData);
      
      const unifiedAppliland = unified.campaigns?.filter(c => 
        c.name?.includes('アプリランド')
      ) || [];
      
      console.log(`   Unified results: ${unifiedAppliland.length}件`);
      unifiedAppliland.slice(0, 10).forEach((campaign, index) => {
        console.log(`   ${index + 1}. ${campaign.name?.substring(0, 50)}...`);
        console.log(`      還元率: ${campaign.cashback}`);
      });

    } catch (error) {
      console.error('ファイル読み込みエラー:', error.message);
    }

    // 3. 高額アプリランド案件の特定
    console.log('\n💰 高額アプリランド案件（50,000pt以上相当）:');
    
    if (dbAppliland) {
      const highValueAppliland = dbAppliland.filter(campaign => {
        const cashback = campaign.cashback_rate || '';
        const match = cashback.match(/(\d+(?:,\d{3})*)/);
        if (match) {
          const points = parseInt(match[1].replace(/,/g, ''));
          return points >= 50000;
        }
        return false;
      });

      console.log(`   データベース内高額案件: ${highValueAppliland.length}件`);
      highValueAppliland.forEach(campaign => {
        console.log(`   - ${campaign.name.substring(0, 60)}`);
        console.log(`     還元率: ${campaign.cashback_rate}`);
      });
    }

    // 4. 推奨アクション
    console.log('\n' + '='.repeat(70));
    console.log('📝 分析結果と推奨アクション:');
    console.log('='.repeat(70));
    
    const dbCount = dbAppliland?.length || 0;
    console.log(`✅ データベース登録済み: ${dbCount}件`);
    
    if (dbCount < 5) {
      console.log('⚠️  アプリランド案件の取得が不十分です');
      console.log('💡 推奨: 包括的なアプリランドスクレイパーの実装が必要');
    } else if (dbCount < 20) {
      console.log('📈 アプリランド案件は取得されていますが、漏れがある可能性があります');
      console.log('💡 推奨: 定期的な差分チェックシステムの実装');
    } else {
      console.log('🎉 アプリランド案件の取得状況は良好です');
      console.log('💡 推奨: 継続的な監視システムの維持');
    }
  }
}

// 実行
(async () => {
  const analyzer = new ApplilandAnalyzer();
  await analyzer.analyzeApplilandCoverage();
})();