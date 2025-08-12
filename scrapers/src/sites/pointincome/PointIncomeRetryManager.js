/**
 * ポイントインカム スクレイピング 自動再実行管理クラス
 * エラー発生時の自動復旧・再実行機能を提供
 */
class PointIncomeRetryManager {
  constructor() {
    this.retryConfig = {
      // エラー種別別の再実行設定
      timeout: { maxRetries: 3, waitTime: 3000, strategy: 'immediate' },
      network: { maxRetries: 3, waitTime: 5000, strategy: 'wait' },
      pageLoad: { maxRetries: 2, waitTime: 2000, strategy: 'browser_restart' },
      element: { maxRetries: 2, waitTime: 1000, strategy: 'immediate' },
      default: { maxRetries: 1, waitTime: 2000, strategy: 'immediate' }
    };
    
    // 失敗カテゴリの管理
    this.failedCategories = new Map();
    this.globalRetryCount = 0;
    this.maxGlobalRetries = 2;
  }

  /**
   * エラー種別を判定
   * @param {Error} error - 発生したエラー
   * @returns {string} エラー種別
   */
  classifyError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('navigation timeout')) {
      return 'timeout';
    }
    if (message.includes('net::') || message.includes('failed to fetch')) {
      return 'network';
    }
    if (message.includes('page') || message.includes('load')) {
      return 'pageLoad';
    }
    if (message.includes('element') || message.includes('selector')) {
      return 'element';
    }
    
    return 'default';
  }

  /**
   * カテゴリレベルの再実行判定
   * @param {number} categoryId - カテゴリID
   * @param {Error} error - 発生したエラー
   * @returns {Object} 再実行判定結果
   */
  shouldRetryCategory(categoryId, error) {
    const errorType = this.classifyError(error);
    const config = this.retryConfig[errorType];
    
    const categoryKey = `${categoryId}`;
    const currentRetries = this.failedCategories.get(categoryKey) || 0;
    
    const shouldRetry = currentRetries < config.maxRetries;
    
    if (shouldRetry) {
      this.failedCategories.set(categoryKey, currentRetries + 1);
    }
    
    return {
      shouldRetry,
      retryCount: currentRetries + 1,
      maxRetries: config.maxRetries,
      waitTime: config.waitTime,
      strategy: config.strategy,
      errorType
    };
  }

  /**
   * 再実行戦略の実行
   * @param {string} strategy - 実行戦略
   * @param {Object} browser - ブラウザインスタンス
   * @param {Object} scrapingConfig - スクレイピング設定
   * @param {string} environment - 環境設定
   * @returns {Object} 更新されたブラウザインスタンス
   */
  async executeRetryStrategy(strategy, browser, scrapingConfig, environment) {
    switch (strategy) {
      case 'immediate':
        console.log('   🔄 即座に再実行...');
        break;
        
      case 'wait':
        console.log('   ⏳ 待機後再実行...');
        await this.sleep(2000);
        break;
        
      case 'browser_restart':
        console.log('   🚀 ブラウザ再起動後再実行...');
        if (browser) {
          await browser.close();
        }
        await this.sleep(3000);
        return scrapingConfig.createBrowser(environment);
        
      default:
        await this.sleep(1000);
    }
    
    return browser;
  }

  /**
   * 全体再実行判定
   * @param {Array} allCategories - 全カテゴリリスト
   * @returns {Object} 全体再実行判定結果
   */
  shouldRetryGlobal(allCategories) {
    const failedCount = this.failedCategories.size;
    const failureRate = failedCount / allCategories.length;
    
    // 失敗率30%以上で全体再実行を検討
    const shouldRetry = (
      failureRate >= 0.3 && 
      this.globalRetryCount < this.maxGlobalRetries
    );
    
    if (shouldRetry) {
      this.globalRetryCount++;
    }
    
    return {
      shouldRetry,
      failedCount,
      failureRate: Math.round(failureRate * 100),
      globalRetryCount: this.globalRetryCount,
      maxGlobalRetries: this.maxGlobalRetries
    };
  }

  /**
   * 失敗したカテゴリのリストを取得
   * @returns {Array} 失敗カテゴリIDのリスト
   */
  getFailedCategories() {
    return Array.from(this.failedCategories.keys()).map(id => parseInt(id));
  }

  /**
   * 統計情報を取得
   * @returns {Object} 再実行統計
   */
  getRetryStats() {
    return {
      totalFailedCategories: this.failedCategories.size,
      globalRetryCount: this.globalRetryCount,
      failedCategoriesDetail: Object.fromEntries(this.failedCategories)
    };
  }

  /**
   * 状態リセット（全体再実行時用）
   */
  resetForGlobalRetry() {
    console.log('🔄 全体再実行のため状態をリセット...');
    this.failedCategories.clear();
  }

  /**
   * Sleep関数
   * @param {number} ms - 待機時間（ミリ秒）
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PointIncomeRetryManager;