'use client';

import { useState } from 'react';

export default function CacheManager() {
  const [isClearing, setIsClearing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const clearSearchCache = async () => {
    setIsClearing(true);
    try {
      // 検索データキャッシュをクリア
      if (typeof window !== 'undefined') {
        // 検索データを強制再読み込み
        await fetch('/search-data.json?' + Date.now(), { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
      }
      
      // Service Worker キャッシュをクリア
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      
      // ローカルストレージとセッションストレージをクリア
      if (typeof Storage !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      
      // 検索結果キャッシュもリセット
      if (typeof window !== 'undefined' && (window as any).searchDataCache) {
        (window as any).searchDataCache = null;
      }
      
      alert('キャッシュをクリアしました。ページを再読み込みします。');
      
      // ブラウザのキャッシュを強制リロード
      window.location.reload();
      
    } catch (error) {
      alert('キャッシュクリアエラー: ' + (error as Error).message);
    } finally {
      setIsClearing(false);
    }
  };

  const checkDataFreshness = async () => {
    setIsChecking(true);
    try {
      const response = await fetch('/search-data.json?' + Date.now());
      const data = await response.json();
      const chobirichCount = data.campaigns.filter((c: any) => c.siteName === 'ちょびリッチ').length;
      alert(`現在の検索データ: ${data.campaigns.length}件\nちょびリッチ: ${chobirichCount}件`);
    } catch (error) {
      alert('データチェックエラー: ' + (error as Error).message);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      <button
        onClick={clearSearchCache}
        disabled={isClearing}
        style={{
          padding: '8px 12px',
          backgroundColor: isClearing ? '#ccc' : '#ff6b6b',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '12px',
          cursor: isClearing ? 'not-allowed' : 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          opacity: isClearing ? 0.6 : 1
        }}
        title="ブラウザキャッシュをクリアして最新データを取得"
      >
        {isClearing ? '⏳ 処理中...' : '🔄 キャッシュクリア'}
      </button>
      <button
        onClick={checkDataFreshness}
        disabled={isChecking}
        style={{
          padding: '8px 12px',
          backgroundColor: isChecking ? '#ccc' : '#4ecdc4',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '12px',
          cursor: isChecking ? 'not-allowed' : 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          opacity: isChecking ? 0.6 : 1
        }}
        title="現在のデータ件数を確認"
      >
        {isChecking ? '⏳ 確認中...' : '📊 データ確認'}
      </button>
    </div>
  );
}