/**
 * ポイントインカム スクレイピング共通設定クラス
 * タイムアウト対策とパフォーマンス最適化の統一管理
 */
class PointIncomeScrapingConfig {
  constructor() {
    this.baseConfig = {
      // 基本タイムアウト設定
      timeout: 45000,
      pageLoadWait: 3000,
      
      // ブラウザ再起動設定
      browserRestartInterval: 5,
      
      // スクロール設定
      scrollWaitTime: 2500,
      maxScrolls: 30,
      stableScrollCount: 2,
      
      // Chrome最適化フラグ
      chromeArgs: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--memory-pressure-off',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      
      // エラー処理設定
      errorHandling: {
        enableTimeoutRecovery: true,
        emergencyRestartOnTimeout: true,
        recoveryWaitTime: 3000
      }
    };

    // 環境別特化設定
    this.environmentSettings = {
      ios: {
        browserRestartInterval: 3,
        categoryWaitTime: 3000,
        additionalMemoryCleanup: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        viewport: { width: 375, height: 812, isMobile: true, hasTouch: true }
      },
      android: {
        browserRestartInterval: 4,
        categoryWaitTime: 2000,
        additionalMemoryCleanup: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36',
        viewport: { width: 360, height: 640, isMobile: true, hasTouch: true }
      },
      desktop: {
        browserRestartInterval: 10,
        categoryWaitTime: 1500,
        additionalMemoryCleanup: false,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
      }
    };

    // システム別設定
    this.systemSettings = {
      normalCampaigns: {
        targetCategories: 83,
        estimatedDuration: 40, // minutes
        highRiskProfile: true,
        recommendedRestartInterval: 8 // より頻繁なブラウザ再起動
      },
      appCampaigns: {
        targetCategories: 18,
        estimatedDuration: 7,
        highRiskProfile: false,
        recommendedRestartInterval: 3
      },
      pcOnlyCampaigns: {
        targetCategories: 1,
        estimatedDuration: 1,
        highRiskProfile: false,
        recommendedRestartInterval: 1
      }
    };
  }

  /**
   * 環境とシステムに応じた最適化設定を取得
   * @param {string} environment - 'ios', 'android', 'desktop'
   * @param {string} system - 'normalCampaigns', 'appCampaigns', 'pcOnlyCampaigns'
   * @returns {Object} 最適化された設定オブジェクト
   */
  getOptimizedConfig(environment = 'desktop', system = 'normalCampaigns') {
    const envSettings = this.environmentSettings[environment] || this.environmentSettings.desktop;
    const sysSettings = this.systemSettings[system] || this.systemSettings.normalCampaigns;
    
    return {
      ...this.baseConfig,
      ...envSettings,
      // システム別の最適化
      browserRestartInterval: sysSettings.recommendedRestartInterval,
      // 高リスクシステムには追加対策
      ...(sysSettings.highRiskProfile && {
        timeout: 60000, // 60秒に延長
        additionalMemoryCleanup: true,
        emergencyRestartThreshold: 2 // 2回連続エラーで緊急再起動
      })
    };
  }

  /**
   * ブラウザ起動設定を取得
   * @param {string} environment - 環境識別子
   * @returns {Object} Puppeteer launch options
   */
  getBrowserLaunchOptions(environment = 'desktop') {
    return {
      headless: true,
      args: this.baseConfig.chromeArgs
    };
  }

  /**
   * タイムアウト対策処理
   * @param {Object} browser - Puppeteerブラウザインスタンス
   * @param {string} environment - 環境識別子
   * @param {number} errorCount - 連続エラー回数
   */
  async handleTimeoutError(browser, environment = 'desktop', errorCount = 1) {
    console.log(`   🚨 ${environment.toUpperCase()} タイムアウト検出 (${errorCount}回目) - 緊急復旧開始`);
    
    if (browser) {
      await browser.close();
    }
    
    const config = this.getOptimizedConfig(environment);
    await this.sleep(config.recoveryWaitTime || 3000);
    
    // メモリクリーンアップ（対応環境のみ）
    if (config.additionalMemoryCleanup && global.gc) {
      console.log(`   🧹 ${environment.toUpperCase()}用メモリクリーンアップ実行`);
      global.gc();
    }
    
    return this.createBrowser(environment);
  }

  /**
   * 環境別ブラウザインスタンス作成
   * @param {string} environment - 環境識別子
   * @returns {Object} Puppeteerブラウザインスタンス
   */
  async createBrowser(environment = 'desktop') {
    const puppeteer = require('puppeteer');
    const options = this.getBrowserLaunchOptions(environment);
    
    const browser = await puppeteer.launch(options);
    
    // 環境別のブラウザコンテキスト設定
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://sp.pointi.jp', []);
    await context.overridePermissions('https://pointi.jp', []);
    
    return browser;
  }

  /**
   * 進捗管理とブラウザ再起動判定
   * @param {number} currentIndex - 現在の処理インデックス
   * @param {string} environment - 環境識別子
   * @param {string} system - システム識別子
   * @returns {Object} 再起動判定結果
   */
  shouldRestartBrowser(currentIndex, environment, system) {
    const config = this.getOptimizedConfig(environment, system);
    const shouldRestart = (currentIndex + 1) % config.browserRestartInterval === 0;
    
    return {
      shouldRestart,
      restartInterval: config.browserRestartInterval,
      waitTime: config.categoryWaitTime || 1000,
      needsMemoryCleanup: config.additionalMemoryCleanup
    };
  }

  /**
   * ユーティリティ: Sleep関数
   * @param {number} ms - 待機時間（ミリ秒）
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 設定情報の出力（デバッグ用）
   * @param {string} environment - 環境識別子
   * @param {string} system - システム識別子
   */
  logConfiguration(environment, system) {
    const config = this.getOptimizedConfig(environment, system);
    console.log(`📋 ${environment.toUpperCase()} × ${system} 最適化設定:`);
    console.log(`   🔄 ブラウザ再起動間隔: ${config.browserRestartInterval}カテゴリ毎`);
    console.log(`   ⏱️ カテゴリ間待機: ${config.categoryWaitTime}ms`);
    console.log(`   🧹 メモリクリーンアップ: ${config.additionalMemoryCleanup ? '有効' : '無効'}`);
    console.log(`   🕐 タイムアウト設定: ${config.timeout}ms`);
  }
}

module.exports = PointIncomeScrapingConfig;