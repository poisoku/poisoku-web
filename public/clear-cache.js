
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
