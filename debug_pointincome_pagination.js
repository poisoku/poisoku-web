#!/usr/bin/env node

/**
 * ポイントインカムのページネーション調査スクリプト
 */

const puppeteer = require('puppeteer');

class PointIncomePaginationDebugger {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.testUrl = 'https://pointi.jp/group/65/'; // ECネットショッピング - 案件が多い
  }

  async investigate() {
    console.log('🔍 ポイントインカム ページネーション調査開始');
    
    const browser = await puppeteer.launch({ 
      headless: false,  // デバッグ用にブラウザを表示
      devtools: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // ユーザーエージェント設定
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      console.log('📄 ページ読み込み:', this.testUrl);
      await page.goto(this.testUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // スクリーンショット撮影
      await page.screenshot({ 
        path: 'pointincome_pagination_debug.png', 
        fullPage: true 
      });

      // 1. 案件数を確認
      const campaigns = await page.$$('.box_ad');
      console.log(`📊 現在のページの案件数: ${campaigns.length}件`);

      // 2. ページネーション要素を詳細調査
      console.log('\n🔍 ページネーション要素調査:');
      
      // 可能な「次へ」ボタンのセレクターを全て試す
      const possibleSelectors = [
        'a:has-text("次へ")',
        'a[title="次へ"]',
        'a[alt="次へ"]',
        '.page_next',
        '.next',
        '.pagination a:last-child',
        'a[onclick*="next"]',
        'a[href="javascript:void(0);"]',
        'input[value="次へ"]',
        'button[type="submit"]'
      ];

      for (const selector of possibleSelectors) {
        try {
          const elements = await page.$$(selector);
          if (elements.length > 0) {
            console.log(`✅ 発見: ${selector} (${elements.length}個)`);
            
            for (let i = 0; i < elements.length; i++) {
              const element = elements[i];
              const tagName = await page.evaluate(el => el.tagName, element);
              const href = await page.evaluate(el => el.getAttribute('href'), element);
              const onclick = await page.evaluate(el => el.getAttribute('onclick'), element);
              const textContent = await page.evaluate(el => el.textContent?.trim(), element);
              const className = await page.evaluate(el => el.className, element);
              
              console.log(`  [${i}] ${tagName}: text="${textContent}", href="${href}", onclick="${onclick}", class="${className}"`);
            }
          }
        } catch (e) {
          // セレクターエラーは無視
        }
      }

      // 3. ページソースから「次へ」を検索
      console.log('\n🔍 HTML内の「次へ」検索:');
      const pageContent = await page.content();
      const nextMatches = pageContent.match(/次へ/g) || [];
      console.log(`「次へ」の出現回数: ${nextMatches.length}回`);

      // 4. すべてのリンクを調査
      console.log('\n🔍 全リンク調査:');
      const allLinks = await page.$$eval('a', links => 
        links.map(link => ({
          href: link.getAttribute('href'),
          text: link.textContent?.trim(),
          onclick: link.getAttribute('onclick'),
          className: link.className,
          id: link.id
        })).filter(link => 
          link.text?.includes('次') || 
          link.href === 'javascript:void(0);' ||
          link.onclick?.includes('next') ||
          link.className?.includes('next')
        )
      );

      allLinks.forEach((link, i) => {
        console.log(`[${i}] "${link.text}" | href: ${link.href} | onclick: ${link.onclick} | class: ${link.className}`);
      });

      // 5. ページネーション用のJavaScript関数を調査
      console.log('\n🔍 JavaScript関数調査:');
      const jsContent = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        return scripts.map(script => script.innerHTML)
          .join('\n')
          .split('\n')
          .filter(line => 
            line.includes('next') || 
            line.includes('page') || 
            line.includes('pagination') ||
            line.includes('次へ')
          )
          .slice(0, 10); // 最初の10行のみ
      });

      jsContent.forEach((line, i) => {
        console.log(`JS[${i}]: ${line.trim()}`);
      });

      console.log('\n⏸️ ブラウザを開いたまま30秒待機（手動確認用）...');
      await page.waitForTimeout(30000);

    } catch (error) {
      console.error('❌ 調査エラー:', error);
    } finally {
      await browser.close();
    }
  }
}

// 実行
async function main() {
  const investigator = new PointIncomePaginationDebugger();
  await investigator.investigate();
}

main().catch(console.error);