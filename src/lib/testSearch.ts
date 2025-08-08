/**
 * 超シンプルな検索テスト - デバッグ専用
 */

export async function testSearchDataAccess() {
  console.log('🧪 検索データアクセステスト開始');
  
  try {
    // 最もシンプルなfetch
    const response = await fetch('/search-data.json');
    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    console.log('📄 Response size:', text.length, 'bytes');
    console.log('📄 First 200 chars:', text.substring(0, 200));
    
    const data = JSON.parse(text);
    console.log('✅ JSON parse successful');
    console.log('📊 Campaigns count:', data.campaigns?.length || 'N/A');
    
    return {
      success: true,
      campaignCount: data.campaigns?.length || 0,
      dataSize: text.length
    };
    
  } catch (error) {
    console.error('❌ テストエラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}