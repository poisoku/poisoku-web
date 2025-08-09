#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function inspectPointIncomeHTML() {
  console.log('🔍 ポイントインカムHTML構造調査');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    await page.goto('https://pointi.jp/list.php?category=66', { 
      waitUntil: 'networkidle2',
      timeout: 20000 
    });

    console.log('✅ ページロード成功');
    
    // ページの基本情報
    const title = await page.title();
    console.log(`📄 ページタイトル: ${title}`);
    
    // .box_ad 要素の数
    const boxAdCount = await page.$$eval('.box_ad', elements => elements.length);
    console.log(`📦 .box_ad 要素数: ${boxAdCount}`);
    
    // 最初の .box_ad の内容を詳しく調査
    if (boxAdCount > 0) {
      const firstAdStructure = await page.evaluate(() => {
        const firstAd = document.querySelector('.box_ad');
        if (!firstAd) return null;
        
        return {
          innerHTML: firstAd.innerHTML.substring(0, 500) + '...',
          titleElement: firstAd.querySelector('.title_list') ? 
            firstAd.querySelector('.title_list').textContent.trim() : 'タイトル要素なし',
          linkElement: firstAd.querySelector('a[href*="./ad/"]') ? 
            firstAd.querySelector('a[href*="./ad/"]').getAttribute('href') : 'リンク要素なし',
          pointElement: firstAd.querySelector('.list_pt_box .list_pt') ? 
            firstAd.querySelector('.list_pt_box .list_pt').textContent.trim() : 'ポイント要素なし'
        };
      });
      
      console.log('📋 最初の案件構造:');
      console.log(`  タイトル: ${firstAdStructure.titleElement}`);
      console.log(`  リンク: ${firstAdStructure.linkElement}`);
      console.log(`  ポイント: ${firstAdStructure.pointElement}`);
    }
    
    // ページネーション関連要素の調査
    const paginationStructure = await page.evaluate(() => {
      // すべてのリンクを調査
      const allLinks = Array.from(document.querySelectorAll('a'));
      const paginationLinks = allLinks.filter(link => {
        const text = link.textContent.trim();
        const onclick = link.getAttribute('onclick');
        return text.includes('次') || text.includes('前') || text.includes('>') || text.includes('<') || 
               (onclick && onclick.includes('tab_select'));
      });
      
      return {
        totalLinks: allLinks.length,
        paginationLinks: paginationLinks.map(link => ({
          text: link.textContent.trim(),
          onclick: link.getAttribute('onclick'),
          href: link.getAttribute('href'),
          className: link.className,
          id: link.id
        }))
      };
    });
    
    console.log(`🔗 総リンク数: ${paginationStructure.totalLinks}`);
    console.log('🔗 ページネーション関連リンク:');
    paginationStructure.paginationLinks.forEach((link, i) => {
      console.log(`  ${i+1}. "${link.text}" (onclick: ${link.onclick}, href: ${link.href})`);
    });
    
    // tab_select 関数の詳細
    const tabSelectInfo = await page.evaluate(() => {
      if (typeof window.tab_select === 'function') {
        return {
          exists: true,
          functionString: window.tab_select.toString().substring(0, 200) + '...'
        };
      }
      return { exists: false };
    });
    
    console.log(`🔧 tab_select関数: ${tabSelectInfo.exists ? '存在' : '存在しない'}`);
    if (tabSelectInfo.exists) {
      console.log(`   関数内容の最初200文字: ${tabSelectInfo.functionString}`);
    }
    
    console.log('\n📸 HTMLスナップショットを取得中...');
    const htmlSnippet = await page.evaluate(() => {
      // ページネーション部分を含む HTML の一部を取得
      const body = document.body;
      if (body) {
        const html = body.innerHTML;
        const start = html.indexOf('次へ') - 200;
        const end = html.indexOf('次へ') + 200;
        return html.substring(Math.max(0, start), end);
      }
      return 'HTML取得不可';
    });
    
    console.log('📸 ページネーション周辺HTML:');
    console.log(htmlSnippet.substring(0, 300) + '...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    await browser.close();
  }
}

inspectPointIncomeHTML();