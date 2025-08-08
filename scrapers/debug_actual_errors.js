#!/usr/bin/env node

/**
 * 実際のエラー原因特定ツール
 * ブラウザ初期化とページアクセスの詳細デバッグ
 */

const puppeteer = require('puppeteer');

class ActualErrorDebugger {
  constructor() {
    this.testResults = [];
  }

  async debugRealErrors() {
    console.log('🔍 実際のエラー原因特定デバッグ');
    console.log('='.repeat(60));

    // Step 1: ブラウザ初期化テスト
    await this.testBrowserInitialization();
    
    // Step 2: 単純ページアクセステスト
    await this.testSimplePageAccess();
    
    // Step 3: ちょびリッチ特定ページテスト
    await this.testChobirichAccess();
    
    // Step 4: Scrapperクラスのテスト
    await this.testScrapperClass();

    this.displayResults();
  }

  /**
   * Step 1: ブラウザ初期化テスト
   */
  async testBrowserInitialization() {
    console.log('\n🎯 Step 1: ブラウザ初期化テスト');
    console.log('-'.repeat(40));

    try {
      console.log('   ブラウザ起動中...');
      const browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
      
      console.log('   ✅ ブラウザ起動成功');
      
      const page = await browser.newPage();
      console.log('   ✅ 新ページ作成成功');
      
      await page.setViewport({ width: 1920, height: 1080 });
      console.log('   ✅ ビューポート設定成功');
      
      await browser.close();
      console.log('   ✅ ブラウザ終了成功');
      
      this.testResults.push({
        test: 'browser_init',
        success: true,
        message: 'ブラウザ初期化は正常'
      });

    } catch (error) {
      console.log(`   ❌ ブラウザ初期化エラー: ${error.message}`);
      this.testResults.push({
        test: 'browser_init', 
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Step 2: 単純ページアクセステスト
   */
  async testSimplePageAccess() {
    console.log('\n🎯 Step 2: 単純ページアクセステスト');
    console.log('-'.repeat(40));

    try {
      const browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      
      console.log('   Google.comアクセス中...');
      await page.goto('https://www.google.com', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      const title = await page.title();
      console.log(`   ✅ アクセス成功: ${title}`);
      
      await browser.close();
      
      this.testResults.push({
        test: 'simple_access',
        success: true,
        message: '外部ページアクセスは正常'
      });

    } catch (error) {
      console.log(`   ❌ 単純アクセスエラー: ${error.message}`);
      this.testResults.push({
        test: 'simple_access',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Step 3: ちょびリッチアクセステスト
   */
  async testChobirichAccess() {
    console.log('\n🎯 Step 3: ちょびリッチアクセステスト');
    console.log('-'.repeat(40));

    const testUrls = [
      'https://www.chobirich.com/',
      'https://www.chobirich.com/shopping/shop/101',
      'https://www.chobirich.com/earn/apply/101'
    ];

    for (const url of testUrls) {
      try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log(`   ${url} アクセス中...`);
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        
        const status = response.status();
        const title = await page.title();
        
        console.log(`   ✅ ステータス: ${status}, タイトル: ${title.substring(0, 30)}...`);
        
        await browser.close();
        
        this.testResults.push({
          test: 'chobirich_access',
          url,
          success: status === 200,
          status,
          title: title.substring(0, 50)
        });

      } catch (error) {
        console.log(`   ❌ ${url} エラー: ${error.message}`);
        this.testResults.push({
          test: 'chobirich_access',
          url,
          success: false,
          error: error.message
        });
      }
    }
  }

  /**
   * Step 4: ExtendedChobirichScrapperクラステスト
   */
  async testScrapperClass() {
    console.log('\n🎯 Step 4: ExtendedChobirichScraper クラステスト');
    console.log('-'.repeat(40));

    try {
      const ExtendedChobirichScraper = require('./src/sites/chobirich/ExtendedChobirichScraper');
      console.log('   ✅ クラス読み込み成功');
      
      const scraper = new ExtendedChobirichScraper();
      console.log('   ✅ インスタンス作成成功');
      
      // 初期化メソッドをテスト
      console.log('   初期化テスト中...');
      
      try {
        await scraper.initialize();
        console.log('   ✅ initialize() 成功');
        
        // ここで実際のエラーが発生しているかチェック
        if (scraper.browser) {
          console.log('   ✅ browser オブジェクト正常');
          
          try {
            const page = await scraper.browser.newPage();
            console.log('   ✅ newPage() 成功');
            await page.close();
          } catch (pageError) {
            console.log(`   ❌ newPage() エラー: ${pageError.message}`);
          }
          
        } else {
          console.log('   ❌ browser オブジェクトが null');
        }
        
        await scraper.cleanup();
        console.log('   ✅ cleanup() 成功');
        
        this.testResults.push({
          test: 'scraper_class',
          success: true,
          message: 'ExtendedChobirichScraper は正常'
        });

      } catch (initError) {
        console.log(`   ❌ initialize() エラー: ${initError.message}`);
        this.testResults.push({
          test: 'scraper_class',
          success: false,
          error: `initialize: ${initError.message}`,
          stage: 'initialization'
        });
      }

    } catch (error) {
      console.log(`   ❌ クラステストエラー: ${error.message}`);
      this.testResults.push({
        test: 'scraper_class',
        success: false,
        error: error.message,
        stage: 'class_load'
      });
    }
  }

  /**
   * 結果表示
   */
  displayResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 実際のエラー原因診断結果');
    console.log('='.repeat(60));

    const successful = this.testResults.filter(r => r.success);
    const failed = this.testResults.filter(r => !r.success);

    console.log(`\n✅ 成功テスト: ${successful.length}`);
    successful.forEach(test => {
      console.log(`   • ${test.test}: ${test.message || 'OK'}`);
    });

    console.log(`\n❌ 失敗テスト: ${failed.length}`);
    failed.forEach(test => {
      console.log(`   • ${test.test}: ${test.error}`);
      if (test.stage) console.log(`     段階: ${test.stage}`);
    });

    console.log('\n🔍 結論:');
    
    if (failed.length === 0) {
      console.log('   すべてのテストが成功 - 403エラーではなく、別の問題の可能性');
    } else {
      const browserInitFailed = failed.find(f => f.test === 'browser_init');
      const scrapperFailed = failed.find(f => f.test === 'scraper_class');
      
      if (browserInitFailed) {
        console.log('   🎯 主原因: Puppeteer ブラウザ初期化の問題');
        console.log('   💡 対策: Puppeteer バージョン確認・環境設定見直し');
      } else if (scrapperFailed) {
        console.log('   🎯 主原因: ExtendedChobirichScraper クラスの問題');
        console.log('   💡 対策: initialize() メソッドのデバッグが必要');
      } else {
        console.log('   🎯 主原因: ちょびリッチ特有のアクセス制限');
        console.log('   💡 対策: User-Agent・ヘッダー設定の見直し');
      }
    }

    console.log('\n📋 次のステップ:');
    if (failed.length > 0) {
      console.log('   1. 失敗したテストの詳細デバッグ');
      console.log('   2. ExtendedChobirichScraper の initialize() メソッド確認');
      console.log('   3. Puppeteer 環境設定の見直し');
    } else {
      console.log('   1. より詳細なスクレイピング処理テスト');
      console.log('   2. 実際のデータ取得処理確認'); 
    }
  }
}

// 実行
async function main() {
  const errorDebugger = new ActualErrorDebugger();
  await errorDebugger.debugRealErrors();
}

if (require.main === module) {
  main();
}