const puppeteer = require('puppeteer');

class DebugPCAppPage {
  constructor() {
    this.baseUrl = 'https://pointi.jp/list.php?category=68';
    this.browser = null;
  }

  async init() {
    console.log('🔍 PC版アプリページ構造確認');
    console.log(`📱 URL: ${this.baseUrl}`);
    console.log('='.repeat(60));
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    // PC用ビューポート設定
    await page.setViewport({ 
      width: 1280, 
      height: 800
    });
    
    // PC UserAgent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    return page;
  }

  async analyzePageStructure() {
    const page = await this.setupPage();
    
    try {
      console.log('📄 ページアクセス中...');
      await page.goto(this.baseUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await this.sleep(3000);
      
      // ページタイトル確認
      const title = await page.title();
      console.log(`📌 ページタイトル: ${title}`);
      
      // ページ構造を分析
      const pageAnalysis = await page.evaluate(() => {
        const analysis = {
          url: window.location.href,
          hasContent: false,
          linkPatterns: [],
          tableStructure: false,
          listStructure: false,
          sampleContent: '',
          allLinks: [],
          campaignElements: []
        };
        
        // リンクパターンの確認
        const linkSelectors = [
          'a[href*="/ad/"]',
          'a[href*="ad_details"]',
          'a[href*="ad_id="]',
          '.campaign-item a',
          '.offer-list a',
          'tr a',
          'li a'
        ];
        
        linkSelectors.forEach(selector => {
          const found = document.querySelectorAll(selector);
          if (found.length > 0) {
            analysis.linkPatterns.push({
              selector: selector,
              count: found.length,
              samples: Array.from(found).slice(0, 3).map(link => ({
                href: link.href,
                text: link.textContent.trim().substring(0, 50)
              }))
            });
          }
        });
        
        // 全てのリンクを収集
        const allLinks = document.querySelectorAll('a[href]');
        analysis.allLinks = Array.from(allLinks)
          .filter(link => link.href.includes('ad') || link.href.includes('campaign'))
          .slice(0, 10)
          .map(link => ({
            href: link.href,
            text: link.textContent.trim().substring(0, 50)
          }));
        
        // テーブル構造の確認
        const tables = document.querySelectorAll('table');
        analysis.tableStructure = tables.length > 0;
        
        // リスト構造の確認
        const lists = document.querySelectorAll('ul, ol');
        analysis.listStructure = lists.length > 0;
        
        // ページ内容のサンプル
        analysis.sampleContent = document.body.textContent.substring(0, 500);
        
        // 案件っぽい要素を探す
        const campaignKeywords = ['案件', 'キャンペーン', 'ポイント', 'pt', '%', 'アプリ', 'ダウンロード'];
        const allElements = document.querySelectorAll('*');
        
        Array.from(allElements).forEach(el => {
          const text = el.textContent;
          if (campaignKeywords.some(keyword => text.includes(keyword)) && text.length < 200) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              analysis.campaignElements.push({
                tagName: el.tagName,
                className: el.className,
                text: text.trim().substring(0, 100),
                hasLink: el.querySelector('a') !== null
              });
            }
          }
        });
        
        analysis.campaignElements = analysis.campaignElements.slice(0, 10);
        
        return analysis;
      });
      
      console.log('\n📊 ページ構造分析結果:');
      console.log(`🔗 実際のURL: ${pageAnalysis.url}`);
      console.log(`📋 テーブル構造: ${pageAnalysis.tableStructure ? '✅' : '❌'}`);
      console.log(`📋 リスト構造: ${pageAnalysis.listStructure ? '✅' : '❌'}`);
      
      console.log('\n🔗 リンクパターン分析:');
      if (pageAnalysis.linkPatterns.length > 0) {
        pageAnalysis.linkPatterns.forEach(pattern => {
          console.log(`  ${pattern.selector}: ${pattern.count}件`);
          pattern.samples.forEach(sample => {
            console.log(`    - ${sample.href}`);
            console.log(`      "${sample.text}"`);
          });
        });
      } else {
        console.log('  ❌ 案件リンクが見つかりません');
      }
      
      console.log('\n🎯 全リンク（ad/campaign含む）:');
      if (pageAnalysis.allLinks.length > 0) {
        pageAnalysis.allLinks.forEach((link, i) => {
          console.log(`  ${i+1}. ${link.href}`);
          console.log(`     "${link.text}"`);
        });
      } else {
        console.log('  ❌ 関連リンクが見つかりません');
      }
      
      console.log('\n📱 案件っぽい要素:');
      if (pageAnalysis.campaignElements.length > 0) {
        pageAnalysis.campaignElements.forEach((element, i) => {
          console.log(`  ${i+1}. <${element.tagName}> ${element.className ? `class="${element.className}"` : ''}`);
          console.log(`     "${element.text}"`);
          console.log(`     リンク有り: ${element.hasLink ? '✅' : '❌'}`);
        });
      }
      
      console.log('\n📄 ページ内容サンプル:');
      console.log(pageAnalysis.sampleContent);
      
    } catch (error) {
      console.error(`❌ エラー: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  async run() {
    try {
      await this.init();
      await this.analyzePageStructure();
      
    } catch (error) {
      console.error('❌ 致命的エラー:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 実行
(async () => {
  const debug = new DebugPCAppPage();
  await debug.run();
})();