#!/usr/bin/env node

/**
 * 高速カテゴリ別案件数チェック
 * 各カテゴリの総ページ数と案件数を効率的に取得
 */

const puppeteer = require('puppeteer');

class QuickCategoryChecker {
  constructor() {
    this.browser = null;
    this.targetCategories = [
      { id: 1, name: 'アンケート・モニター' },
      { id: 2, name: 'サービス・他' },
      { id: 3, name: 'ショッピング' },
      { id: 4, name: 'サービス' },
      { id: 5, name: 'クレジットカード' },
      { id: 6, name: 'ショッピング詳細' },
      { id: 7, name: '旅行・レジャー' },
      { id: 8, name: 'エンタメ' },
      { id: 9, name: 'その他' },
      { id: 10, name: '特別カテゴリ' }
    ];
    this.baseUrl = 'https://pc.moppy.jp/category/list.php';
  }

  async initialize() {
    console.log('🚀 高速カテゴリ別案件数チェック開始...');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async checkCategory(categoryId, categoryName) {
    console.log(`\n📂 カテゴリ${categoryId}（${categoryName}）チェック中...`);
    
    const page = await this.browser.newPage();
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // 1ページ目を確認して総件数とページ情報を取得
      const pageUrl = `${this.baseUrl}?parent_category=${categoryId}&af_sorter=1&page=1`;
      
      await page.goto(pageUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // ページ情報と総件数を取得
      const categoryInfo = await page.evaluate(() => {
        const bodyText = document.body.textContent;
        
        // 「XXX件」のような表示を探す
        const totalCountMatch = bodyText.match(/(\d+)件/);
        
        // ページネーション情報
        const paginationMatch = bodyText.match(/(\d+)\s*-\s*(\d+)を表示\s*\/\s*(\d+)件中/);
        
        // 案件リンク数をカウント
        const campaignLinks = document.querySelectorAll('a[href*="/shopping/detail.php"], a[href*="/ad/detail.php"]');
        let validLinks = 0;
        
        campaignLinks.forEach(link => {
          const href = link.href;
          
          // プロモーション案件を除外
          if (href.includes('track_ref=tw') || 
              href.includes('track_ref=reg') ||
              href.includes('track_ref=recommend') ||
              href.includes('track_ref=promotion')) {
            return;
          }
          
          // site_id確認
          const siteIdMatch = href.match(/site_id=(\d+)/);
          if (siteIdMatch) {
            validLinks++;
          }
        });
        
        // 広告なしメッセージチェック
        const noAdsMessage = bodyText.includes('条件に一致する広告はありません') ||
                            bodyText.includes('該当する広告がありません');
        
        return {
          totalCountText: totalCountMatch ? totalCountMatch[1] : null,
          pagination: paginationMatch ? {
            start: parseInt(paginationMatch[1]),
            end: parseInt(paginationMatch[2]),
            total: parseInt(paginationMatch[3])
          } : null,
          validLinksOnPage1: validLinks,
          hasNoAds: noAdsMessage
        };
      });
      
      if (categoryInfo.hasNoAds) {
        console.log(`   🚫 広告なし`);
        return {
          categoryId,
          categoryName,
          totalCount: 0,
          estimatedPages: 0,
          page1Links: 0
        };
      }
      
      let estimatedPages = 0;
      let totalCount = 0;
      
      if (categoryInfo.pagination) {
        totalCount = categoryInfo.pagination.total;
        const itemsPerPage = categoryInfo.pagination.end - categoryInfo.pagination.start + 1;
        estimatedPages = Math.ceil(totalCount / itemsPerPage);
      } else if (categoryInfo.totalCountText) {
        totalCount = parseInt(categoryInfo.totalCountText);
        // ページあたり約30件と仮定
        estimatedPages = Math.ceil(totalCount / 30);
      }
      
      console.log(`   📊 推定総件数: ${totalCount}件`);
      console.log(`   📄 推定ページ数: ${estimatedPages}ページ`);
      console.log(`   🔗 1ページ目有効リンク: ${categoryInfo.validLinksOnPage1}件`);
      
      return {
        categoryId,
        categoryName,
        totalCount: totalCount,
        estimatedPages: estimatedPages,
        page1Links: categoryInfo.validLinksOnPage1,
        pagination: categoryInfo.pagination
      };
      
    } catch (error) {
      console.error(`   ❌ エラー: ${error.message}`);
      return {
        categoryId,
        categoryName,
        totalCount: 0,
        estimatedPages: 0,
        page1Links: 0,
        error: error.message
      };
    } finally {
      await page.close();
    }
  }

  async checkAll() {
    await this.initialize();
    
    const results = [];
    
    try {
      for (const category of this.targetCategories) {
        const result = await this.checkCategory(category.id, category.name);
        results.push(result);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // サマリーレポート
      console.log('\n' + '='.repeat(60));
      console.log('📊 カテゴリ別案件数サマリー');
      console.log('='.repeat(60));
      
      let grandTotal = 0;
      let grandPages = 0;
      
      results.forEach(result => {
        if (result.totalCount > 0) {
          console.log(`📂 カテゴリ${result.categoryId} (${result.categoryName}): ${result.totalCount}件 (約${result.estimatedPages}ページ)`);
          grandTotal += result.totalCount;
          grandPages += result.estimatedPages;
        } else {
          console.log(`📂 カテゴリ${result.categoryId} (${result.categoryName}): 案件なし`);
        }
      });
      
      console.log('\n' + '-'.repeat(60));
      console.log(`🎯 総計: ${grandTotal}件 (約${grandPages}ページ)`);
      
      return results;
      
    } finally {
      await this.browser.close();
    }
  }
}

// 実行
async function main() {
  const checker = new QuickCategoryChecker();
  await checker.checkAll();
}

main().catch(console.error);