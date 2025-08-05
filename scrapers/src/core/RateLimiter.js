/**
 * レート制限と403エラー対策クラス
 */
class RateLimiter {
  constructor(config) {
    this.config = config.rate_limit;
    this.errorConfig = config.rate_limit.error_403_handling;
    
    // 統計情報
    this.stats = {
      totalRequests: 0,
      successful: 0,
      errors403: 0,
      errors403Timeline: [],  // 403エラーのタイムライン
      lastRequestTime: null,
      sessionRequests: 0,
      currentWaitTime: this.errorConfig.initial_wait
    };
    
    // 403エラーパターン分析
    this.errorPatterns = {
      consecutiveErrors: 0,
      lastErrorTime: null,
      recoveryTime: null,
      blockedPeriods: []
    };
  }

  /**
   * リクエスト前の待機処理
   */
  async waitBeforeRequest(isNewCategory = false, isNewPage = false) {
    const now = Date.now();
    
    // セッション管理
    if (this.stats.sessionRequests >= this.config.session.max_requests_per_session) {
      console.log(`📊 セッション上限到達。${this.config.session.session_break_time}秒休憩...`);
      await this.sleep(this.config.session.session_break_time);
      this.stats.sessionRequests = 0;
    }
    
    // カテゴリ切り替え時
    if (isNewCategory) {
      console.log(`🔄 カテゴリ切り替え: ${this.config.delay_between_categories}秒待機`);
      await this.sleep(this.config.delay_between_categories);
    }
    // ページ切り替え時
    else if (isNewPage) {
      console.log(`📄 ページ切り替え: ${this.config.delay_between_pages}秒待機`);
      await this.sleep(this.config.delay_between_pages);
    }
    // 通常のリクエスト間隔
    else if (this.stats.lastRequestTime) {
      const elapsed = (now - this.stats.lastRequestTime) / 1000;
      const minDelay = this.config.delay_between_requests;
      
      if (elapsed < minDelay) {
        const waitTime = minDelay - elapsed;
        console.log(`⏳ リクエスト間隔調整: ${waitTime.toFixed(1)}秒待機`);
        await this.sleep(waitTime);
      }
    }
    
    // リクエスト/分の制限チェック
    await this.checkRequestsPerMinute();
    
    this.stats.lastRequestTime = Date.now();
    this.stats.totalRequests++;
    this.stats.sessionRequests++;
  }

  /**
   * 403エラー処理
   */
  async handle403Error(url) {
    const now = new Date();
    this.stats.errors403++;
    this.stats.errors403Timeline.push({
      time: now,
      url: url
    });
    
    this.errorPatterns.consecutiveErrors++;
    this.errorPatterns.lastErrorTime = now;
    
    // エラーパターン分析
    this.analyze403Pattern();
    
    // 待機時間の計算（指数バックオフ）
    const waitTime = Math.min(
      this.stats.currentWaitTime * Math.pow(this.errorConfig.backoff_multiplier, this.errorPatterns.consecutiveErrors - 1),
      this.errorConfig.max_wait
    );
    
    console.log('🚫 403エラー検出！');
    console.log(`   連続エラー回数: ${this.errorPatterns.consecutiveErrors}`);
    console.log(`   待機時間: ${waitTime}秒`);
    console.log(`   エラー発生URL: ${url}`);
    
    // 待機時間を記録
    this.errorPatterns.blockedPeriods.push({
      start: now,
      duration: waitTime,
      url: url
    });
    
    await this.sleep(waitTime);
    
    // 待機後の処理
    this.stats.currentWaitTime = waitTime;
    
    return {
      shouldRetry: this.errorPatterns.consecutiveErrors <= this.errorConfig.max_retries,
      waitedTime: waitTime,
      recommendation: this.getRecommendation()
    };
  }

  /**
   * 403エラーパターンの分析
   */
  analyze403Pattern() {
    const timeline = this.stats.errors403Timeline;
    if (timeline.length < 2) return;
    
    // 直近1時間のエラー頻度を計算
    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentErrors = timeline.filter(e => e.time > oneHourAgo);
    
    console.log(`📊 403エラー分析:`);
    console.log(`   総エラー数: ${this.stats.errors403}`);
    console.log(`   直近1時間: ${recentErrors.length}回`);
    
    // パターン検出
    if (recentErrors.length > 10) {
      console.log('⚠️ 警告: 高頻度の403エラーを検出');
      console.log('   推奨: アクセス頻度を大幅に減らすか、一時停止を検討');
    }
    
    // エラー間隔の分析
    if (timeline.length >= 2) {
      const intervals = [];
      for (let i = 1; i < timeline.length; i++) {
        intervals.push((timeline[i].time - timeline[i-1].time) / 1000);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      console.log(`   平均エラー間隔: ${avgInterval.toFixed(1)}秒`);
    }
  }

  /**
   * リクエスト成功時の処理
   */
  onRequestSuccess() {
    this.stats.successful++;
    
    // 連続エラーカウントをリセット
    if (this.errorPatterns.consecutiveErrors > 0) {
      console.log('✅ アクセス回復を確認');
      this.errorPatterns.consecutiveErrors = 0;
      this.errorPatterns.recoveryTime = new Date();
      this.stats.currentWaitTime = this.errorConfig.initial_wait;
    }
  }

  /**
   * 推奨事項の取得
   */
  getRecommendation() {
    const errorRate = this.stats.errors403 / this.stats.totalRequests;
    
    if (errorRate > 0.5) {
      return {
        severity: 'critical',
        message: 'エラー率が50%を超えています。大幅な設定変更が必要です。',
        suggestions: [
          'requests_per_minute を 10 以下に設定',
          'delay_between_requests を 10秒以上に設定',
          '1時間以上の待機を推奨'
        ]
      };
    } else if (errorRate > 0.2) {
      return {
        severity: 'warning',
        message: 'エラー率が高めです。設定の調整を推奨します。',
        suggestions: [
          'requests_per_minute を現在の半分に設定',
          'delay_between_requests を倍に設定'
        ]
      };
    } else {
      return {
        severity: 'ok',
        message: 'エラー率は許容範囲内です。',
        suggestions: []
      };
    }
  }

  /**
   * 分あたりリクエスト数の制限
   */
  async checkRequestsPerMinute() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // 1分以内のリクエスト数をカウント
    const recentRequests = this.stats.errors403Timeline.filter(
      e => e.time > new Date(oneMinuteAgo)
    ).length + this.stats.sessionRequests;
    
    if (recentRequests >= this.config.requests_per_minute) {
      const waitTime = 60 - ((now - oneMinuteAgo) / 1000);
      console.log(`⏰ 分あたりリクエスト上限。${waitTime.toFixed(1)}秒待機`);
      await this.sleep(waitTime);
    }
  }

  /**
   * 統計情報の取得
   */
  getStats() {
    const successRate = this.stats.totalRequests > 0 
      ? ((this.stats.successful / this.stats.totalRequests) * 100).toFixed(1)
      : 0;
    
    return {
      ...this.stats,
      successRate: `${successRate}%`,
      recommendation: this.getRecommendation()
    };
  }

  /**
   * 統計情報のリセット
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      successful: 0,
      errors403: 0,
      errors403Timeline: [],
      lastRequestTime: null,
      sessionRequests: 0,
      currentWaitTime: this.errorConfig.initial_wait
    };
    
    this.errorPatterns = {
      consecutiveErrors: 0,
      lastErrorTime: null,
      recoveryTime: null,
      blockedPeriods: []
    };
  }

  /**
   * スリープ関数
   */
  sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  /**
   * 設定の動的更新
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    console.log('⚙️ レート制限設定を更新しました');
  }
}

module.exports = RateLimiter;