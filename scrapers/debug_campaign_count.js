#!/usr/bin/env node

/**
 * 案件数詳細デバッグツール
 * 各カテゴリの重複除去前・後の案件数を詳細報告
 */

const puppeteer = require('puppeteer');

class CampaignCountDebugger {
  constructor() {
    this.browser = null;
    this.categoryReports = [];
    
    // 10カテゴリで全Web案件をカバー
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
    this.seenSiteIds = new Set();
  }

  async initialize() {
    console.log('🔍 案件数詳細デバッグ開始...');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async debugCategory(categoryId, categoryName) {
    console.log(`\n📂 カテゴリ${categoryId}（${categoryName}）詳細分析...`);
    
    const page = await this.browser.newPage();
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      let currentPage = 1;
      let hasNextPage = true;
      let totalRawCount = 0;
      let totalUniqueCount = 0;
      let totalDuplicateCount = 0;
      let pageCount = 0;
      let consecutiveEmptyPages = 0;
      const maxEmptyPages = 3;
      
      while (hasNextPage && currentPage <= 100) { // 最大100ページまで詳細分析
        const pageUrl = `${this.baseUrl}?parent_category=${categoryId}&af_sorter=1&page=${currentPage}`;
        
        try {
          await page.goto(pageUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
          });
          
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // 「条件に一致する広告はありません」チェック
          const noAdsMessage = await page.evaluate(() => {
            const pageText = document.body.textContent;
            return pageText.includes('条件に一致する広告はありません') ||
                   pageText.includes('該当する広告がありません');
          });
          
          if (noAdsMessage) {
            console.log(`   📄 ページ${currentPage}: 広告なしメッセージ検出（終了）`);
            hasNextPage = false;
            break;
          }
          
          // 案件リンク数をカウント
          const pageStats = await page.evaluate(() => {
            const links = document.querySelectorAll('a[href*="/shopping/detail.php"], a[href*="/ad/detail.php"]');
            
            let validLinks = 0;
            let excludedLinks = 0;
            const siteIds = [];
            
            links.forEach(link => {
              const href = link.href;
              
              // プロモーション案件チェック
              if (href.includes('track_ref=tw') || 
                  href.includes('track_ref=reg') ||
                  href.includes('track_ref=recommend') ||
                  href.includes('track_ref=promotion')) {
                excludedLinks++;
                return;
              }
              
              // site_id抽出
              const siteIdMatch = href.match(/site_id=(\d+)/);
              if (siteIdMatch) {
                siteIds.push(siteIdMatch[1]);
                validLinks++;
              }
            });
            
            return {
              totalLinks: links.length,
              validLinks: validLinks,
              excludedLinks: excludedLinks,
              siteIds: siteIds
            };
          });
          
          // 重複チェック
          let uniqueCount = 0;
          let duplicateCount = 0;
          
          for (const siteId of pageStats.siteIds) {
            if (!this.seenSiteIds.has(siteId)) {
              this.seenSiteIds.add(siteId);
              uniqueCount++;
            } else {
              duplicateCount++;
            }
          }
          
          totalRawCount += pageStats.validLinks;
          totalUniqueCount += uniqueCount;
          totalDuplicateCount += duplicateCount;
          pageCount++;
          
          // 連続空ページ検出
          if (pageStats.validLinks === 0) {
            consecutiveEmptyPages++;
            console.log(`   📄 ページ${currentPage}: 案件が見つかりませんでした（連続空ページ ${consecutiveEmptyPages}/${maxEmptyPages}）`);
            
            if (consecutiveEmptyPages >= maxEmptyPages) {
              console.log(`   🏁 連続${maxEmptyPages}ページ空のため処理終了`);
              hasNextPage = false;
              break;
            }
          } else {
            consecutiveEmptyPages = 0; // 案件があったのでリセット
          }

          console.log(`   📄 ページ${currentPage}:`);
          console.log(`      🔗 総リンク数: ${pageStats.totalLinks}件`);
          console.log(`      ✅ 有効リンク: ${pageStats.validLinks}件`);
          console.log(`      🚫 除外リンク: ${pageStats.excludedLinks}件`);
          console.log(`      🆕 新規案件: ${uniqueCount}件`);
          console.log(`      🔄 重複案件: ${duplicateCount}件`);
          
          // この条件は連続空ページ検出に統合されたため削除
          
          currentPage++;
          
        } catch (error) {
          console.error(`   ❌ ページ ${currentPage} エラー:`, error.message);
          hasNextPage = false;
        }
      }
      
      const categoryReport = {
        categoryId,
        categoryName,
        pageCount,
        totalRawCount,
        totalUniqueCount,
        totalDuplicateCount
      };
      
      this.categoryReports.push(categoryReport);
      
      console.log(`   📊 カテゴリ${categoryId} 集計:`);
      console.log(`      📄 処理ページ数: ${pageCount}ページ`);
      console.log(`      📦 重複除去前: ${totalRawCount}件`);
      console.log(`      ✨ 重複除去後: ${totalUniqueCount}件`);
      console.log(`      🔄 重複件数: ${totalDuplicateCount}件`);
      
    } finally {
      await page.close();
    }
  }

  async debugAll() {
    await this.initialize();
    
    try {
      // 各カテゴリを分析
      for (const category of this.targetCategories) {
        await this.debugCategory(category.id, category.name);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // 総合レポート
      console.log('\n' + '='.repeat(60));
      console.log('📊 総合レポート（カテゴリ別詳細）');
      console.log('='.repeat(60));
      
      let grandTotalRaw = 0;
      let grandTotalUnique = 0;
      let grandTotalDuplicate = 0;
      let grandTotalPages = 0;
      
      this.categoryReports.forEach(report => {
        console.log(`📂 カテゴリ${report.categoryId} (${report.categoryName}):`);
        console.log(`   📄 ページ数: ${report.pageCount}, 重複除去前: ${report.totalRawCount}件, 重複除去後: ${report.totalUniqueCount}件, 重複: ${report.totalDuplicateCount}件`);
        
        grandTotalRaw += report.totalRawCount;
        grandTotalUnique += report.totalUniqueCount;
        grandTotalDuplicate += report.totalDuplicateCount;
        grandTotalPages += report.pageCount;
      });
      
      console.log('\n' + '-'.repeat(60));
      console.log('🎯 総合計:');
      console.log(`📄 総処理ページ数: ${grandTotalPages}ページ`);
      console.log(`📦 重複除去前総数: ${grandTotalRaw}件`);
      console.log(`✨ 重複除去後総数: ${grandTotalUnique}件`);
      console.log(`🔄 総重複件数: ${grandTotalDuplicate}件`);
      console.log(`📈 重複率: ${Math.round(grandTotalDuplicate / grandTotalRaw * 100)}%`);
      
    } finally {
      await this.browser.close();
    }
  }
}

// 実行
async function main() {
  const analyzer = new CampaignCountDebugger();
  await analyzer.debugAll();
}

main().catch(console.error);