#!/usr/bin/env node

/**
 * ポイントインカム修正版テスト（1カテゴリのみ）
 */

const PointIncomeOptimized = require('./scrapers/src/sites/pointincome/PointIncomeOptimized');

async function testSingleCategory() {
    console.log('🔧 修正版テスト: 1カテゴリのみ実行');
    
    const scraper = new PointIncomeOptimized();
    
    try {
        await scraper.initializeBrowser();
        
        // shopping_66カテゴリのみテスト
        const testCategory = {
            id: 66,
            name: 'ショッピングカテゴリ66',
            url: 'https://pointi.jp/list.php?category=66',
            type: 'shopping'
        };
        
        console.log('📋 設定確認:');
        console.log(`   User-Agent: ${scraper.config.userAgent?.substring(0, 50)}...`);
        console.log(`   Viewport: ${JSON.stringify(scraper.config.viewport)}`);
        console.log(`   Timeout: ${scraper.config.timeout}ms`);
        
        await scraper.processCategory('shopping_66', testCategory, 0);
        
        console.log(`\n✅ テスト完了: ${scraper.results.length}件取得`);
        
        if (scraper.results.length > 0) {
            console.log(`🎯 取得例: ${scraper.results[0].title}`);
        }
        
    } catch (error) {
        console.error('❌ テストエラー:', error.message);
    } finally {
        if (scraper.browser) {
            await scraper.browser.close();
        }
    }
}

testSingleCategory();