#!/usr/bin/env node

/**
 * モッピー正確なカテゴリ案件スクレイパー
 * メインコンテンツエリアのみから正しい案件を取得
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class MoppyAccurateScraper {
  constructor() {
    this.baseUrl = 'https://pc.moppy.jp';
    this.campaigns = [];
    this.errors = [];
    this.stats = {
      totalCategories: 0,
      processedCategories: 0,
      totalCampaigns: 0,
      campaignsWithPoints: 0,
      pointDetectionRate: 0,
      startTime: new Date()
    };
    
    // テスト用カテゴリ（修正対象）
    this.categoryUrls = [
      { url: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=80&af_sorter=1&page=1', name: '総合通販', type: 'shopping' },
      { url: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=51&af_sorter=1&page=1', name: '金融・投資', type: 'service' },
      { url: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=143&af_sorter=1&page=1', name: 'ファッション', type: 'shopping' }
    ];
    
    this.stats.totalCategories = this.categoryUrls.length;
  }

  /**
   * メイン実行関数
   */
  async execute() {
    console.log('🎯 モッピー正確なカテゴリ案件スクレイパー起動');
    console.log('='.repeat(60));
    console.log('📋 メインコンテンツエリア限定取得版');
    console.log('='.repeat(60));

    let browser;
    try {
      browser = await this.launchOptimizedBrowser();
      
      for (const category of this.categoryUrls) {
        await this.processCategoryAccurate(browser, category);
        await this.sleep(2000);
      }
      
      // 統計計算
      this.stats.pointDetectionRate = this.stats.campaignsWithPoints / this.stats.totalCampaigns;
      
      await this.saveResults();
      this.generateReport();
      
    } catch (error) {
      console.error('💥 致命的エラー:', error);
      this.errors.push({
        type: 'FATAL',
        message: error.message
      });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * 最適化ブラウザ起動
   */
  async launchOptimizedBrowser() {
    console.log('🚀 最適化ブラウザ起動中...');
    
    return await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });
  }

  /**
   * 正確なカテゴリ処理
   */
  async processCategoryAccurate(browser, category) {
    console.log(`\n📂 カテゴリ処理開始: ${category.name}`);
    
    const page = await browser.newPage();
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      console.log(`  📄 ページアクセス中...`);
      await page.goto(category.url, {
        waitUntil: 'networkidle2',
        timeout: 45000
      });
      
      // 十分な待機時間
      await this.sleep(5000);
      
      // スクロール操作で全要素を表示
      await page.evaluate(async () => {
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        
        // ページ全体を段階的にスクロール
        const scrollHeight = document.body.scrollHeight;
        const viewportHeight = window.innerHeight;
        
        for (let y = 0; y < scrollHeight; y += viewportHeight / 3) {
          window.scrollTo(0, y);
          await delay(1000);
        }
        
        // 最後に一番下までスクロール
        window.scrollTo(0, scrollHeight);
        await delay(2000);
        
        // 最後にトップに戻る
        window.scrollTo(0, 0);
        await delay(1000);
      });
      
      console.log('  📊 正確な案件抽出実行中...');
      
      // 正確な案件抽出（メインコンテンツエリアのみ）
      const campaigns = await this.extractMainContentCampaigns(page, category);
      
      if (campaigns.length > 0) {
        this.campaigns.push(...campaigns);
        this.stats.totalCampaigns += campaigns.length;
        
        // ポイント検出数をカウント
        const withPoints = campaigns.filter(c => c.points && c.points !== '').length;
        this.stats.campaignsWithPoints += withPoints;
        
        console.log(`  ✅ 取得: ${campaigns.length}件 (ポイント情報: ${withPoints}件)`);
        
        // 取得した案件の一部を表示
        if (campaigns.length > 0) {
          console.log('  📦 取得案件例:');
          campaigns.slice(0, 3).forEach((c, i) => {
            console.log(`    ${i + 1}. ${c.title.slice(0, 30)}... (${c.points || 'ポイント未検出'})`);
          });
        }
      } else {
        console.log('  ⚠️ 案件が見つかりませんでした');
      }
      
      this.stats.processedCategories++;
      
    } catch (error) {
      console.error(`  ❌ エラー: ${error.message}`);
      this.errors.push({
        category: category.name,
        error: error.message
      });
    } finally {
      await page.close();
    }
  }

  /**
   * メインコンテンツエリアからの正確な案件抽出
   */
  async extractMainContentCampaigns(page, category) {
    return await page.evaluate((categoryInfo) => {
      const campaigns = new Map();
      
      // メインコンテンツエリアの特定
      // 構造解析結果から、正しい案件は m-list__item クラスに含まれることが判明
      const mainContentSelectors = [
        '.m-list__item',           // メインの案件リストアイテム
        '#content .m-list__item',  // contentエリア内の案件アイテム
      ];
      
      // 除外すべきエリア（誤取得源）
      const excludeSelectors = [
        '.m-trending-words__list-item',  // 注目ワードエリア
        '.m-trending-words',             // 注目ワード全体
        '[class*="trending"]',           // トレンド関連
        '[class*="recommend"]',          // おすすめエリア  
        '[class*="popular"]',            // 人気エリア
        '.sidebar',                      // サイドバー
        '.header',                       // ヘッダー
        '.footer'                        // フッター
      ];
      
      // メインコンテンツエリアから案件を抽出
      mainContentSelectors.forEach(selector => {
        const containers = document.querySelectorAll(selector);
        
        containers.forEach(container => {
          // 除外エリアに含まれているかチェック
          let isExcluded = false;
          excludeSelectors.forEach(excludeSelector => {
            if (container.closest(excludeSelector)) {
              isExcluded = true;
            }
          });
          
          if (isExcluded) {
            return; // 除外エリアの場合はスキップ
          }
          
          // 案件リンクの抽出
          const links = container.querySelectorAll('a[href]');
          
          links.forEach(link => {
            const href = link.href;
            
            // 案件URLパターンのチェック
            if (href.includes('/shopping/detail.php') || 
                href.includes('/ad/detail.php')) {
              
              // track_ref=tw のリンクは除外（注目ワードエリアの特徴）
              if (href.includes('track_ref=tw')) {
                return;
              }
              
              const siteIdMatch = href.match(/site_id=(\d+)/);
              const siteId = siteIdMatch ? siteIdMatch[1] : null;
              
              if (siteId && !campaigns.has(siteId)) {
                const campaign = {
                  id: `moppy_${siteId}`,
                  url: href,
                  title: '',
                  points: '',
                  pointsYen: '',
                  image: '',
                  containerClass: container.className || '',
                  linkContainer: link.closest('.m-list__item') ? 'main-content' : 'other'
                };
                
                // タイトル取得
                campaign.title = link.title || 
                                link.getAttribute('data-title') ||
                                link.getAttribute('alt');
                
                // 画像からタイトル
                const img = link.querySelector('img');
                if (img && !campaign.title) {
                  campaign.title = img.alt || img.title;
                  campaign.image = img.src;
                }
                
                // テキストからタイトル
                if (!campaign.title) {
                  const linkText = link.textContent.trim();
                  if (linkText && linkText.length > 0 && linkText.length < 200) {
                    // 改行や余分な空白を整理
                    campaign.title = linkText.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();
                  }
                }
                
                // ポイント情報の抽出（コンテナ全体から）
                campaign.points = extractPointsFromContainer(container);
                
                // タイトルがある場合のみ追加
                if (campaign.title && campaign.title.length > 0) {
                  campaigns.set(siteId, campaign);
                }
              }
            }
          });
        });
      });
      
      // ポイント抽出関数
      function extractPointsFromContainer(container) {
        const containerText = container.textContent || '';
        
        // 様々なポイントパターン
        const patterns = [
          // 基本パターン
          { regex: /(\d{1,6}(?:,\d{3})*)(?:\s*)([PpＰ])/g, confidence: 5, format: (num, unit) => `${num}${unit}` },
          { regex: /(\d{1,6}(?:,\d{3})*)(?:\s*)ポイント/g, confidence: 5, format: (num) => `${num}P` },
          
          // パーセントパターン
          { regex: /(\d+(?:\.\d+)?)(?:\s*)([%％])/g, confidence: 5, format: (num, unit) => `${num}${unit}` },
          
          // 最大・最高パターン
          { regex: /最大(?:\s*)(\d{1,6}(?:,\d{3})*)(?:\s*)([PpＰ])/g, confidence: 4, format: (num, unit) => `最大${num}${unit}` },
          { regex: /最高(?:\s*)(\d{1,6}(?:,\d{3})*)(?:\s*)([PpＰ])/g, confidence: 4, format: (num, unit) => `最高${num}${unit}` },
          
          // 円相当パターン
          { regex: /(\d{1,6}(?:,\d{3})*)(?:\s*)円相当/g, confidence: 4, format: (num) => `${num}円相当` },
          { regex: /(\d{1,6}(?:,\d{3})*)(?:\s*)円分/g, confidence: 4, format: (num) => `${num}円分` },
          
          // 獲得パターン
          { regex: /獲得(?:\s*)(\d{1,6}(?:,\d{3})*)(?:\s*)([PpＰ])/g, confidence: 4, format: (num, unit) => `${num}${unit}` },
          
          // pt表記パターン
          { regex: /(\d{1,6}(?:,\d{3})*)(?:\s*)(pt)/gi, confidence: 4, format: (num, unit) => `${num}${unit}` }
        ];
        
        let bestPoints = '';
        let confidence = 0;
        
        patterns.forEach(pattern => {
          const matches = [...containerText.matchAll(pattern.regex)];
          matches.forEach(match => {
            if (pattern.confidence > confidence) {
              if (match[2]) {
                bestPoints = pattern.format(match[1], match[2]);
              } else {
                bestPoints = pattern.format(match[1]);
              }
              confidence = pattern.confidence;
            }
          });
        });
        
        return bestPoints;
      }
      
      // 結果の整形と返却
      const results = [];
      campaigns.forEach(campaign => {
        // 1pt = 1円の換算
        if (campaign.points && !campaign.points.includes('%')) {
          const pointMatch = campaign.points.match(/(\d{1,6}(?:,\d{3})*)/);
          if (pointMatch) {
            const pointValue = parseInt(pointMatch[1].replace(/,/g, ''));
            campaign.pointsYen = `${pointValue.toLocaleString()}円`;
          }
        }
        
        results.push({
          ...campaign,
          category: categoryInfo.name,
          categoryType: categoryInfo.type,
          device: 'All',
          scrapedAt: new Date().toISOString()
        });
      });
      
      return results;
    }, category);
  }

  /**
   * 結果保存
   */
  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `moppy_accurate_${timestamp}.json`;
    const filepath = path.join(__dirname, '..', '..', '..', 'data', 'moppy', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const output = {
      scrapeDate: new Date().toISOString(),
      version: '4.0.0',
      systemType: 'moppy_accurate_scraper',
      description: 'メインコンテンツエリア限定の正確な案件抽出',
      stats: {
        totalCampaigns: this.campaigns.length,
        campaignsWithPoints: this.stats.campaignsWithPoints,
        pointDetectionRate: Math.round(this.stats.pointDetectionRate * 100),
        totalCategories: this.stats.processedCategories,
        executionTime: Math.round((new Date() - this.stats.startTime) / 1000),
        errors: this.errors.length
      },
      campaigns: this.campaigns,
      errors: this.errors
    };
    
    await fs.writeFile(filepath, JSON.stringify(output, null, 2));
    console.log(`\n💾 保存完了: ${filename}`);
  }

  /**
   * レポート生成
   */
  generateReport() {
    const executionTime = Math.round((new Date() - this.stats.startTime) / 1000);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 正確な案件抽出完了レポート');
    console.log('='.repeat(60));
    console.log(`✅ 取得案件数: ${this.campaigns.length}件`);
    console.log(`💰 ポイント情報取得: ${this.stats.campaignsWithPoints}件`);
    console.log(`📈 ポイント検出率: ${Math.round(this.stats.pointDetectionRate * 100)}%`);
    console.log(`📂 処理カテゴリ: ${this.stats.processedCategories}/${this.stats.totalCategories}`);
    console.log(`⏱️ 実行時間: ${executionTime}秒`);
    console.log(`❌ エラー数: ${this.errors.length}件`);
    
    if (this.campaigns.length > 0) {
      // カテゴリ別の内訳を表示
      const categoryStats = {};
      this.campaigns.forEach(c => {
        if (!categoryStats[c.category]) {
          categoryStats[c.category] = { total: 0, withPoints: 0 };
        }
        categoryStats[c.category].total++;
        if (c.points && c.points !== '') {
          categoryStats[c.category].withPoints++;
        }
      });
      
      console.log('\n📊 カテゴリ別統計:');
      Object.entries(categoryStats).forEach(([category, stats]) => {
        console.log(`  ${category}: ${stats.total}件 (ポイント付き: ${stats.withPoints}件)`);
      });
      
      // 成功例を表示
      const withPoints = this.campaigns.filter(c => c.points && c.points !== '');
      if (withPoints.length > 0) {
        console.log('\n💎 正確な案件取得例（最初の5件）:');
        withPoints.slice(0, 5).forEach((c, i) => {
          console.log(`${i + 1}. [${c.category}] ${c.title.slice(0, 40)}...`);
          console.log(`   💰 ポイント: ${c.points}`);
          if (c.pointsYen) console.log(`   💴 円換算: ${c.pointsYen}`);
        });
      }
    }
  }

  /**
   * スリープ関数
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 実行
if (require.main === module) {
  const scraper = new MoppyAccurateScraper();
  scraper.execute().catch(console.error);
}

module.exports = MoppyAccurateScraper;