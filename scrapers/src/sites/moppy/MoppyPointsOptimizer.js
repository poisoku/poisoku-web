#!/usr/bin/env node

/**
 * モッピーポイント情報最適化スクレイパー
 * リストページでのポイント検出精度を大幅改善
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class MoppyPointsOptimizer {
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
    
    // テスト用カテゴリ（複数追加）
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
    console.log('🎯 モッピーポイント情報最適化システム起動');
    console.log('='.repeat(60));
    console.log('📊 ポイント検出精度改善版');
    console.log('='.repeat(60));

    let browser;
    try {
      browser = await this.launchOptimizedBrowser();
      
      for (const category of this.categoryUrls) {
        await this.processWithOptimizedExtraction(browser, category);
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
      headless: true, // 安定性のためヘッドレス
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
   * 最適化された抽出処理
   */
  async processWithOptimizedExtraction(browser, category) {
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
      
      console.log('  📊 最適化ポイント抽出実行中...');
      
      // 最適化されたポイント抽出
      const campaigns = await this.extractWithAdvancedPointDetection(page, category);
      
      if (campaigns.length > 0) {
        this.campaigns.push(...campaigns);
        this.stats.totalCampaigns += campaigns.length;
        
        // ポイント検出数をカウント
        const withPoints = campaigns.filter(c => c.points && c.points !== '').length;
        this.stats.campaignsWithPoints += withPoints;
        
        console.log(`  ✅ 取得: ${campaigns.length}件 (ポイント情報: ${withPoints}件)`);
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
   * 高精度ポイント検出システム
   */
  async extractWithAdvancedPointDetection(page, category) {
    return await page.evaluate((categoryInfo) => {
      const campaigns = new Map();
      
      // フェーズ1: 全リンクから案件を収集
      const allLinks = document.querySelectorAll('a[href]');
      
      allLinks.forEach((link) => {
        const href = link.href;
        
        if (href.includes('/shopping/detail.php') || 
            href.includes('/ad/detail.php') ||
            href.includes('site_id=')) {
          
          const siteIdMatch = href.match(/site_id=(\d+)/);
          const siteId = siteIdMatch ? siteIdMatch[1] : null;
          
          if (siteId) {
            campaigns.set(siteId, {
              id: `moppy_${siteId}`,
              url: href,
              title: '',
              points: '',
              pointsYen: '',
              rawPointText: '',
              image: '',
              link: link
            });
          }
        }
      });
      
      // フェーズ2: 各案件の詳細情報を収集
      campaigns.forEach((campaign, siteId) => {
        const link = campaign.link;
        
        // タイトル取得（優先度順）
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
            campaign.title = linkText.replace(/\s+/g, ' ');
          }
        }
        
        // フェーズ3: 高度なポイント検出
        campaign.points = detectPointsAdvanced(link);
        
        delete campaign.link; // DOM要素削除
      });
      
      // DOM要素削除後の高度なポイント検出関数を定義
      function detectPointsAdvanced(link) {
        let bestPoints = '';
        let confidence = 0;
        
        // 検索範囲を段階的に拡大
        const searchContainers = [
          link.parentElement,
          link.closest('li'),
          link.closest('div'),
          link.closest('article'),
          link.closest('section'),
          link.closest('tr'),
          link.closest('td')
        ].filter(container => container !== null);
        
        searchContainers.forEach((container, level) => {
          if (bestPoints && confidence > 3) return; // 十分な精度で見つかった場合はスキップ
          
          const containerText = container.textContent || '';
          const containerHtml = container.innerHTML || '';
          
          // より多様なポイントパターン
          const patterns = [
            // 基本パターン
            { regex: /(\d{1,6}(?:,\d{3})*)\s*[PpＰ]/g, confidence: 5, format: p => `${p}P` },
            { regex: /(\d{1,6}(?:,\d{3})*)\s*ポイント/g, confidence: 5, format: p => `${p}P` },
            
            // 最大・最高パターン
            { regex: /最大\s*(\d{1,6}(?:,\d{3})*)\s*[PpＰ]/g, confidence: 4, format: p => `最大${p}P` },
            { regex: /最高\s*(\d{1,6}(?:,\d{3})*)\s*[PpＰ]/g, confidence: 4, format: p => `最高${p}P` },
            { regex: /最大\s*(\d{1,6}(?:,\d{3})*)/g, confidence: 3, format: p => `最大${p}` },
            
            // 円相当パターン
            { regex: /(\d{1,6}(?:,\d{3})*)\s*円相当/g, confidence: 4, format: p => `${p}円相当` },
            { regex: /(\d{1,6}(?:,\d{3})*)\s*円分/g, confidence: 4, format: p => `${p}円分` },
            
            // パーセントパターン
            { regex: /(\d+(?:\.\d+)?)\s*[%％]/g, confidence: 5, format: p => `${p}%` },
            
            // 獲得パターン
            { regex: /獲得\s*(\d{1,6}(?:,\d{3})*)\s*[PpＰ]/g, confidence: 4, format: p => `${p}P` },
            { regex: /獲得\s*(\d{1,6}(?:,\d{3})*)/g, confidence: 3, format: p => `${p}` },
            
            // pt表記パターン
            { regex: /(\d{1,6}(?:,\d{3})*)\s*pt/gi, confidence: 4, format: p => `${p}pt` },
            
            // 特殊パターン
            { regex: /\+\s*(\d{1,6}(?:,\d{3})*)\s*[PpＰ]/g, confidence: 3, format: p => `+${p}P` },
            { regex: /合計\s*(\d{1,6}(?:,\d{3})*)/g, confidence: 3, format: p => `合計${p}` }
          ];
          
          patterns.forEach(pattern => {
            const matches = [...containerText.matchAll(pattern.regex)];
            matches.forEach(match => {
              if (pattern.confidence > confidence) {
                bestPoints = pattern.format(match[1]);
                confidence = pattern.confidence;
              }
            });
          });
          
          // HTML内の特定要素からポイントを探す
          if (confidence < 4) {
            const pointElements = container.querySelectorAll(
              '[class*="point"], [class*="Point"], [class*="reward"], [class*="amount"], [class*="price"], strong, .value, .number'
            );
            
            pointElements.forEach(el => {
              const text = el.textContent.trim();
              if (/\d/.test(text) && text.length < 50) {
                // 簡単なパターンマッチング
                const simpleMatch = text.match(/(\d{1,6}(?:,\d{3})*)/);
                if (simpleMatch && confidence < 2) {
                  bestPoints = text;
                  confidence = 2;
                }
              }
            });
          }
        });
        
        return bestPoints;
      }
      
      // フェーズ4: 結果の整形と返却
      const results = [];
      campaigns.forEach(campaign => {
        // 1pt = 1円の換算
        if (campaign.points) {
          const pointMatch = campaign.points.match(/(\d{1,6}(?:,\d{3})*)/);
          if (pointMatch && !campaign.points.includes('%')) {
            const pointValue = parseInt(pointMatch[1].replace(/,/g, ''));
            campaign.pointsYen = `${pointValue.toLocaleString()}円`;
          }
        }
        
        // タイトルがある案件のみ追加
        if (campaign.title && campaign.title.length > 0) {
          results.push({
            ...campaign,
            category: categoryInfo.name,
            categoryType: categoryInfo.type,
            device: 'All',
            scrapedAt: new Date().toISOString()
          });
        }
      });
      
      return results;
    }, category);
  }

  /**
   * 結果保存
   */
  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `moppy_points_optimized_${timestamp}.json`;
    const filepath = path.join(__dirname, '..', '..', '..', 'data', 'moppy', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const output = {
      scrapeDate: new Date().toISOString(),
      version: '3.0.0',
      systemType: 'moppy_points_optimizer',
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
    console.log('📊 ポイント最適化完了レポート');
    console.log('='.repeat(60));
    console.log(`✅ 取得案件数: ${this.campaigns.length}件`);
    console.log(`💰 ポイント情報取得: ${this.stats.campaignsWithPoints}件`);
    console.log(`📈 ポイント検出率: ${Math.round(this.stats.pointDetectionRate * 100)}%`);
    console.log(`📂 処理カテゴリ: ${this.stats.processedCategories}/${this.stats.totalCategories}`);
    console.log(`⏱️ 実行時間: ${executionTime}秒`);
    console.log(`❌ エラー数: ${this.errors.length}件`);
    
    if (this.campaigns.length > 0) {
      // ポイント検出成功例を表示
      const withPoints = this.campaigns.filter(c => c.points && c.points !== '');
      
      if (withPoints.length > 0) {
        console.log('\n💎 ポイント検出成功例（最初の5件）:');
        withPoints.slice(0, 5).forEach((c, i) => {
          console.log(`${i + 1}. ${c.title}`);
          console.log(`   💰 ポイント: ${c.points}`);
          if (c.pointsYen) console.log(`   💴 円換算: ${c.pointsYen}`);
        });
      }
      
      // ポイント検出失敗例も表示
      const withoutPoints = this.campaigns.filter(c => !c.points || c.points === '');
      if (withoutPoints.length > 0) {
        console.log(`\n⚠️ ポイント未検出: ${withoutPoints.length}件`);
        console.log('改善が必要な案件例:');
        withoutPoints.slice(0, 3).forEach((c, i) => {
          console.log(`  ${i + 1}. ${c.title}`);
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
  const optimizer = new MoppyPointsOptimizer();
  optimizer.execute().catch(console.error);
}

module.exports = MoppyPointsOptimizer;