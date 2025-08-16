#!/usr/bin/env node

/**
 * 整理後スクレイパーの動作確認（1ページテスト）
 */

const MoppyAppScraperV3 = require('./src/sites/moppy/MoppyAppScraperV3');

async function testCleanScraper() {
  console.log('🧪 整理後スクレイパーの動作確認テスト開始...');
  
  const scraper = new MoppyAppScraperV3();
  
  try {
    await scraper.initialize();
    
    // iOS 1ページのみテスト
    console.log('\n📱 iOS 1ページテスト...');
    const iosCampaigns = await scraper.scrapeWithOS('ios');
    console.log(`iOS: ${iosCampaigns.length}件取得`);
    
    if (iosCampaigns.length > 0) {
      console.log(`サンプル案件: ${iosCampaigns[0].title} [${iosCampaigns[0].device}]`);
    }
    
    // OS分析テスト
    const osStats = scraper.analyzeOSDistribution(iosCampaigns);
    console.log(`OS分析: iOS=${osStats.iOS}, Android=${osStats.Android}`);
    
    console.log('\n✅ 整理後コードの動作確認完了');
    console.log('📊 基本機能が正常に動作しています');
    
  } catch (error) {
    console.error('❌ テストエラー:', error);
  } finally {
    await scraper.cleanup();
  }
}

testCleanScraper().catch(console.error);