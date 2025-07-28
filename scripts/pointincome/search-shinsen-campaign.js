const puppeteer = require('puppeteer');

class SearchShinsenCampaign {
  constructor() {
    this.browser = null;
    this.searchTerms = [
      '三國志',
      '三国志', 
      '真戦',
      'sangoku',
      'sangokushi',
      'shinsen'
    ];
    
    // 検索対象URL
    this.searchUrls = [
      'https://sp.pointi.jp/list.php?cat_no=68', // アプリカテゴリ
      'https://pointi.jp/list.php?category=68',  // PC版アプリ
      'https://sp.pointi.jp/list.php',           // 全案件
      'https://pointi.jp/list.php',              // PC版全案件
      'https://sp.pointi.jp/search.php',         // 検索ページ
      'https://pointi.jp/search.php'             // PC版検索
    ];
  }

  async init() {
    console.log('🔍 三國志 真戦案件の詳細調査開始');
    console.log('🎯 複数カテゴリ・複数キーワードで徹底検索');
    console.log('='.repeat(70));
    
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

  async setupPage(isMobile = true) {
    const page = await this.browser.newPage();
    
    if (isMobile) {
      await page.setViewport({ 
        width: 375, 
        height: 812,
        isMobile: true,
        hasTouch: true
      });
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
    } else {
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    }
    
    return page;
  }

  async searchInPage(url, searchTerm) {
    const isMobile = url.includes('sp.');
    const page = await this.setupPage(isMobile);
    
    try {
      console.log(`\n📄 検索中: ${url}`);
      console.log(`🔍 キーワード: "${searchTerm}"`);
      
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await this.sleep(2000);
      
      // ページ内検索
      const searchResults = await page.evaluate((term) => {
        const results = [];
        const allText = document.body.textContent.toLowerCase();
        
        // ページ全体にキーワードが含まれているかチェック
        const hasKeyword = allText.includes(term.toLowerCase());
        
        if (hasKeyword) {
          // キーワードを含む要素を探す
          const allElements = document.querySelectorAll('*');
          
          for (const element of allElements) {
            const text = element.textContent;
            if (text && text.toLowerCase().includes(term.toLowerCase()) && text.length < 200) {
              const links = element.querySelectorAll('a[href]');
              results.push({
                text: text.trim(),
                hasLink: links.length > 0,
                links: Array.from(links).map(link => ({
                  href: link.href,
                  text: link.textContent.trim()
                })).slice(0, 3)
              });
            }
          }
        }
        
        return {
          hasKeyword,
          url: window.location.href,
          results: results.slice(0, 10) // 最初の10件まで
        };
      }, searchTerm);
      
      if (searchResults.hasKeyword) {
        console.log(`  ✅ キーワード "${searchTerm}" が見つかりました！`);
        console.log(`  📍 実際のURL: ${searchResults.url}`);
        
        if (searchResults.results.length > 0) {
          console.log(`  📋 関連要素 (${searchResults.results.length}件):`);
          searchResults.results.forEach((result, i) => {
            console.log(`    ${i+1}. "${result.text.substring(0, 100)}"`);
            if (result.hasLink) {
              result.links.forEach(link => {
                console.log(`       🔗 ${link.href}`);
                console.log(`          "${link.text}"`);
              });
            }
          });
        }
        
        return searchResults;
      } else {
        console.log(`  ❌ キーワード "${searchTerm}" は見つかりませんでした`);
        return null;
      }
      
    } catch (error) {
      console.log(`  ❌ エラー: ${error.message}`);
      return null;
    } finally {
      await page.close();
    }
  }

  async performSiteWideSearch() {
    console.log('\n🌐 サイト全体検索の実行...');
    
    const page = await this.setupPage(true);
    
    try {
      // ポイントインカムの検索機能を使用
      await page.goto('https://sp.pointi.jp/', { waitUntil: 'networkidle2' });
      await this.sleep(2000);
      
      // 検索ボックスを探す
      const hasSearchBox = await page.evaluate(() => {
        const searchInputs = document.querySelectorAll('input[type="text"], input[type="search"], input[name*="search"], input[placeholder*="検索"]');
        return searchInputs.length > 0;
      });
      
      if (hasSearchBox) {
        console.log('🔍 サイト内検索機能を発見');
        
        for (const term of ['三國志', '真戦']) {
          try {
            console.log(`\n🔍 サイト内検索: "${term}"`);
            
            await page.evaluate((searchTerm) => {
              const searchInputs = document.querySelectorAll('input[type="text"], input[type="search"], input[name*="search"], input[placeholder*="検索"]');
              if (searchInputs.length > 0) {
                searchInputs[0].value = searchTerm;
                searchInputs[0].focus();
              }
            }, term);
            
            await this.sleep(1000);
            
            // Enterキーまたは検索ボタンをクリック
            await page.keyboard.press('Enter');
            await this.sleep(3000);
            
            // 検索結果を分析
            const searchResults = await page.evaluate(() => {
              const campaigns = [];
              const links = document.querySelectorAll('a[href*="/ad/"]');
              
              links.forEach(link => {
                const container = link.closest('div, li, tr');
                if (container) {
                  campaigns.push({
                    title: container.textContent.trim().substring(0, 100),
                    url: link.href
                  });
                }
              });
              
              return campaigns;
            });
            
            if (searchResults.length > 0) {
              console.log(`  ✅ 検索結果: ${searchResults.length}件`);
              searchResults.slice(0, 5).forEach((result, i) => {
                console.log(`    ${i+1}. ${result.title}`);
                console.log(`       ${result.url}`);
              });
            } else {
              console.log(`  ❌ 検索結果なし`);
            }
            
          } catch (searchError) {
            console.log(`  ❌ 検索エラー: ${searchError.message}`);
          }
        }
      } else {
        console.log('❌ サイト内検索機能が見つかりません');
      }
      
    } catch (error) {
      console.log(`❌ サイト全体検索エラー: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  async run() {
    try {
      await this.init();
      
      let foundResults = [];
      
      // 各URLと各キーワードの組み合わせで検索
      for (const url of this.searchUrls) {
        for (const term of this.searchTerms) {
          const result = await this.searchInPage(url, term);
          if (result) {
            foundResults.push(result);
          }
          await this.sleep(1000);
        }
      }
      
      // サイト内検索も実行
      await this.performSiteWideSearch();
      
      console.log('\n' + '='.repeat(70));
      console.log('📊 検索結果まとめ');
      console.log(`🔍 発見された関連情報: ${foundResults.length}件`);
      
      if (foundResults.length > 0) {
        console.log('\n✅ 発見された情報:');
        foundResults.forEach((result, i) => {
          console.log(`\n${i+1}. URL: ${result.url}`);
          console.log(`   関連要素数: ${result.results.length}件`);
        });
      } else {
        console.log('\n❌ 三國志 真戦関連の案件は発見されませんでした');
        console.log('   可能性:');
        console.log('   - 期間限定案件で現在は非掲載');
        console.log('   - 特別な条件(会員ランク等)で表示される');
        console.log('   - 別のポイントサイトでの案件');
        console.log('   - 案件名が異なる表記');
      }
      
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
  const searcher = new SearchShinsenCampaign();
  await searcher.run();
})();