const fs = require('fs').promises;

class ForceCacheClearFix {
  constructor() {
    this.searchDataPath = '/Users/kn/poisoku-web/public/search-data.json';
  }

  async addCacheBusterToSearchData() {
    console.log('🔧 検索データにキャッシュバスター情報を追加');
    console.log('='.repeat(60));

    try {
      // 現在の検索データを読み込み
      const searchDataContent = await fs.readFile(this.searchDataPath, 'utf8');
      const searchData = JSON.parse(searchDataContent);

      // メタデータにタイムスタンプとキャッシュバスター情報を追加
      const now = new Date();
      searchData.metadata = searchData.metadata || {};
      searchData.metadata.lastUpdated = now.toISOString();
      searchData.metadata.cacheBuster = Date.now();
      searchData.metadata.version = '2.0';
      searchData.metadata.deployTimestamp = now.toISOString();

      // 統計情報を追加
      const siteStats = {};
      searchData.campaigns.forEach(campaign => {
        const siteName = campaign.siteName;
        siteStats[siteName] = (siteStats[siteName] || 0) + 1;
      });

      searchData.metadata.sites = siteStats;
      searchData.metadata.totalCampaigns = searchData.campaigns.length;

      // ファイルに書き戻し
      await fs.writeFile(this.searchDataPath, JSON.stringify(searchData, null, 2));

      console.log('✅ キャッシュバスター情報を追加完了');
      console.log(`   タイムスタンプ: ${searchData.metadata.lastUpdated}`);
      console.log(`   キャッシュバスター: ${searchData.metadata.cacheBuster}`);
      console.log(`   バージョン: ${searchData.metadata.version}`);
      console.log(`   総案件数: ${searchData.metadata.totalCampaigns}`);

      // サイト別統計を表示
      console.log('\n📊 サイト別案件数:');
      Object.entries(siteStats).forEach(([site, count]) => {
        console.log(`   ${site}: ${count}件`);
      });

      return searchData.metadata;

    } catch (error) {
      console.error('キャッシュバスター追加エラー:', error);
      throw error;
    }
  }

  async generateCacheClearScript() {
    console.log('\n📝 キャッシュクリア用スクリプト生成');
    
    const clearScript = `
// ポイ速キャッシュクリアスクリプト v2.0
(function() {
  console.log('🔄 ポイ速キャッシュクリアスクリプト実行中...');
  
  // 1. 検索データキャッシュをクリア
  if (window.searchDataCache) {
    window.searchDataCache = null;
    console.log('✅ 検索データキャッシュをクリア');
  }
  
  // 2. ローカルストレージをクリア
  if (typeof Storage !== 'undefined') {
    localStorage.clear();
    sessionStorage.clear();
    console.log('✅ ローカルストレージをクリア');
  }
  
  // 3. Service Workerをクリア
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for(let registration of registrations) {
        registration.unregister();
      }
      console.log('✅ Service Workerをクリア');
    });
  }
  
  // 4. 検索データを強制再読み込み
  fetch('/search-data.json?' + Date.now(), {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  }).then(response => response.json())
    .then(data => {
      console.log('✅ 最新検索データ取得完了:', data.metadata?.totalCampaigns + '件');
      console.log('🎉 キャッシュクリア完了！ページを再読み込みしてください。');
      
      // 自動リロード
      setTimeout(() => {
        window.location.reload(true);
      }, 1000);
    })
    .catch(error => {
      console.error('検索データ取得エラー:', error);
    });
})();
`;

    const scriptPath = '/Users/kn/poisoku-web/public/clear-cache.js';
    await fs.writeFile(scriptPath, clearScript);
    
    console.log(`✅ キャッシュクリアスクリプトを生成: ${scriptPath}`);
    console.log('💡 ブラウザで以下のURLにアクセスしてスクリプトを実行できます:');
    console.log('   https://poisoku.jp/clear-cache.js');
  }

  async runFix() {
    console.log('🚀 強制キャッシュクリア修正開始');
    console.log('='.repeat(60));

    try {
      // 1. 検索データにキャッシュバスター情報を追加
      const metadata = await this.addCacheBusterToSearchData();

      // 2. キャッシュクリアスクリプトを生成
      await this.generateCacheClearScript();

      console.log('\n🎉 強制キャッシュクリア修正完了！');
      console.log('='.repeat(60));
      console.log('📋 次の手順:');
      console.log('1. git add . && git commit -m "Fix cache busting for search data"');
      console.log('2. git push でデプロイ');
      console.log('3. ユーザーにキャッシュクリアボタンの使用を案内');
      console.log('4. 必要に応じて https://poisoku.jp/clear-cache.js を共有');

      return metadata;

    } catch (error) {
      console.error('修正エラー:', error);
      throw error;
    }
  }
}

// 実行
async function runFix() {
  const fix = new ForceCacheClearFix();
  await fix.runFix();
}

runFix().catch(console.error);