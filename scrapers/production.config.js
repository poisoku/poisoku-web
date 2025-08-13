/**
 * 本番環境設定ファイル
 * ポイ速スクレイピングシステム本番運用設定
 */

module.exports = {
  // 基本設定
  environment: 'production',
  version: '3.0.0',
  
  // ファイルパス設定
  paths: {
    scrapersDir: __dirname,
    dataDir: __dirname + '/data',
    outputDir: __dirname + '/../public',
    logsDir: __dirname + '/logs',
    backupDir: __dirname + '/data/backups'
  },
  
  // ちょびリッチ設定
  chobirich: {
    // メインシステム（v3）
    mainSystem: {
      file: 'complete_chobirich_system_v3.js',
      enabled: true,
      schedule: '0 2 * * *', // 毎日2時実行
      timeout: 3600000, // 60分タイムアウト
      expectedCampaigns: { min: 3500, max: 4000 }
    },
    
    // アプリシステム
    appSystem: {
      file: 'main_mobile_app.js',
      enabled: true,
      schedule: '0 6,18 * * *', // 朝6時・夕方6時実行
      timeout: 1800000, // 30分タイムアウト
      expectedCampaigns: { min: 500, max: 600 }
    },
    
    // 拡張システム（高速処理用）
    extendedSystem: {
      file: 'main_extended.js',
      enabled: false, // 必要時のみ有効化
      timeout: 300000, // 5分タイムアウト
      expectedCampaigns: { min: 100, max: 300 }
    }
  },
  
  // ポイントインカム設定
  pointincome: {
    // アプリシステム
    appSystem: {
      file: 'src/sites/pointincome/PointIncomeOptimizedAppScraper.js',
      enabled: true,
      schedule: '0 4 * * *', // 毎日4時実行
      timeout: 600000, // 10分タイムアウト
      expectedCampaigns: { min: 300, max: 400 }
    },
    
    // PC専用システム
    pcSystem: {
      file: 'src/sites/pointincome/PointIncomePCOnlyScraper.js',
      enabled: true,
      schedule: '0 5 * * *', // 毎日5時実行
      timeout: 120000, // 2分タイムアウト
      expectedCampaigns: { min: 0, max: 5 }
    },
    
    // Webシステム
    webSystem: {
      file: 'src/sites/pointincome/PointIncomeWebScraperComplete.js',
      enabled: true,
      schedule: '0 1 * * *', // 毎日1時実行
      timeout: 3600000, // 60分タイムアウト
      expectedCampaigns: { min: 2500, max: 3000 }
    }
  },
  
  // データ統合設定
  integration: {
    file: '../scripts/integrate-all-scraping-data.js',
    enabled: true,
    schedule: '0 8 * * *', // 毎日8時実行（全取得完了後）
    timeout: 300000, // 5分タイムアウト
    expectedTotal: { min: 7000, max: 8000 }
  },
  
  // 自動デプロイ設定
  deployment: {
    enabled: true,
    autoCommit: true,
    autoPush: true,
    commitMessage: 'chore: Update campaign data (automated)',
    branch: 'main'
  },
  
  // 監視・アラート設定
  monitoring: {
    enabled: true,
    alertThresholds: {
      campaignCountVariation: 0.2, // 20%以上の変動でアラート
      executionTimeMultiplier: 2.0, // 予定時間の2倍でアラート
      errorRate: 0.05 // 5%以上のエラー率でアラート
    },
    logRetentionDays: 30,
    backupRetentionDays: 7
  },
  
  // セキュリティ設定
  security: {
    rateLimiting: {
      chobirich: {
        requestInterval: 3000, // 3秒間隔
        browserRestartInterval: 3 // 3カテゴリ毎
      },
      pointincome: {
        requestInterval: 2000, // 2秒間隔
        browserRestartInterval: 15 // 15カテゴリ毎
      }
    },
    userAgents: {
      rotation: false, // User-Agent固定（安定性優先）
      respectRobotsTxt: true
    }
  },
  
  // パフォーマンス設定
  performance: {
    maxMemoryUsage: '2GB',
    maxConcurrentBrowsers: 1,
    enableHeadless: true,
    enableCache: false // リアルタイムデータ優先
  },
  
  // 開発・デバッグ設定
  debug: {
    enabled: false, // 本番では無効
    verboseLogging: false,
    saveRawHtml: false,
    screenshotOnError: false
  }
};