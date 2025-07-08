const puppeteer = require('puppeteer');

async function testDetailPage() {
  console.log('🔍 ポイントインカムの詳細ページ構造を詳しく調査中...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 詳細ページの例
    const detailUrls = [
      'https://pointi.jp/ad/151817/',  // 50円分
      'https://pointi.jp/ad/150815/',  // 1,080円分
      'https://pointi.jp/ad/153325/'   // 別の案件
    ];
    
    for (const url of detailUrls) {
      console.log(`\n📄 詳細ページ分析: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // スクリーンショットを撮る
      const urlId = url.match(/ad\/(\d+)/)[1];
      await page.screenshot({ path: `pointincome-detail-${urlId}.png` });
      console.log(`📸 スクリーンショット保存: pointincome-detail-${urlId}.png`);
      
      // ページ全体の構造を詳しく調査
      const pageInfo = await page.evaluate(() => {
        const info = {
          title: '',
          pointText: '',
          yenText: '',
          description: '',
          conditions: '',
          structure: {},
          allTexts: []
        };
        
        // タイトルを探す（様々なパターン）
        const titleSelectors = [
          'h1', 'h2', 'h3',
          '.campaign_name', '.offer_name', '.ad_name',
          '.title', '[class*="title"]',
          '.heading', '[class*="heading"]'
        ];
        
        for (const sel of titleSelectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent.trim()) {
            info.title = el.textContent.trim();
            info.structure.titleSelector = sel;
            break;
          }
        }
        
        // ポイント表示を探す（赤い大きな表示など）
        const pointSelectors = [
          '.point_display', '.point_amount', '.reward_point',
          '.campaign_point', '.offer_point',
          '[class*="point"]:not([class*="explain"])',
          '.reward', '[class*="reward"]',
          'span[style*="color: red"]', 'div[style*="color: red"]'
        ];
        
        for (const sel of pointSelectors) {
          const elements = document.querySelectorAll(sel);
          elements.forEach(el => {
            const text = el.textContent.trim();
            if (text.match(/\d/) && text.match(/pt|ポイント|円分/)) {
              info.allTexts.push({
                selector: sel,
                text: text,
                fontSize: window.getComputedStyle(el).fontSize,
                color: window.getComputedStyle(el).color
              });
              
              if (text.match(/\d+\s*pt/i) && !info.pointText) {
                info.pointText = text;
                info.structure.pointSelector = sel;
              }
            }
          });
        }
        
        // 円分表記を探す
        const bodyHTML = document.body.innerHTML;
        const yenMatches = bodyHTML.match(/[(（](\d{1,3}(?:,\d{3})*円分)[)）]/g);
        if (yenMatches) {
          info.yenText = yenMatches[0];
          
          // 円分表記がどこにあるか探す
          const yenElements = Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent.includes(yenMatches[0]) && 
            el.children.length === 0
          );
          if (yenElements.length > 0) {
            info.structure.yenElement = {
              tag: yenElements[0].tagName,
              class: yenElements[0].className,
              parent: yenElements[0].parentElement.className
            };
          }
        }
        
        // 案件説明を探す
        const descSelectors = [
          '.campaign_description', '.offer_description',
          '.description', '[class*="description"]',
          '.detail', '[class*="detail"]'
        ];
        
        for (const sel of descSelectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent.length > 20) {
            info.description = el.textContent.trim().substring(0, 200);
            info.structure.descriptionSelector = sel;
            break;
          }
        }
        
        // 条件を探す
        const conditionSelectors = [
          '.condition', '.terms', '.requirement',
          '[class*="condition"]', '[class*="terms"]'
        ];
        
        for (const sel of conditionSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            info.conditions = el.textContent.trim().substring(0, 200);
            info.structure.conditionSelector = sel;
            break;
          }
        }
        
        // 主要な要素のクラス名を収集
        const mainElements = document.querySelectorAll('.main, #main, [class*="content"], [class*="detail"]');
        info.structure.mainClasses = Array.from(mainElements).map(el => ({
          tag: el.tagName,
          class: el.className,
          id: el.id
        })).slice(0, 5);
        
        return info;
      });
      
      console.log('\n📊 ページ情報:');
      console.log(`  タイトル: ${pageInfo.title || '見つかりません'}`);
      console.log(`  ポイント: ${pageInfo.pointText || '見つかりません'}`);
      console.log(`  円換算: ${pageInfo.yenText || '見つかりません'}`);
      console.log(`  説明: ${pageInfo.description ? pageInfo.description.substring(0, 50) + '...' : '見つかりません'}`);
      
      console.log('\n🔧 構造情報:');
      console.log(`  タイトルセレクタ: ${pageInfo.structure.titleSelector || 'なし'}`);
      console.log(`  ポイントセレクタ: ${pageInfo.structure.pointSelector || 'なし'}`);
      
      if (pageInfo.structure.yenElement) {
        console.log(`  円分表記の場所: ${pageInfo.structure.yenElement.tag}.${pageInfo.structure.yenElement.class}`);
      }
      
      if (pageInfo.allTexts.length > 0) {
        console.log('\n💰 発見したポイント関連テキスト:');
        pageInfo.allTexts.forEach(text => {
          console.log(`  - "${text.text}" (${text.selector}, size: ${text.fontSize}, color: ${text.color})`);
        });
      }
      
      // HTMLソースの一部を確認
      const htmlSample = await page.evaluate(() => {
        const mainContent = document.querySelector('.main, #main, [class*="content"]');
        if (mainContent) {
          return mainContent.innerHTML.substring(0, 1000);
        }
        return document.body.innerHTML.substring(0, 1000);
      });
      
      console.log('\n📝 HTMLサンプル:');
      console.log(htmlSample.substring(0, 300) + '...');
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('\n✅ 詳細ページ調査完了！');
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
testDetailPage();