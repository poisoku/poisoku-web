#!/usr/bin/env node

/**
 * モッピー「総合通販」カテゴリページ構造詳細調査
 * 正しいメインコンテンツエリアと案件抽出範囲を特定
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function investigateMoppyStructure() {
  console.log('🔍 モッピー総合通販カテゴリ構造調査開始');
  
  const browser = await puppeteer.launch({
    headless: false, // 視覚的確認のため
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    // ステルス設定
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
    });
    
    const targetUrl = 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=80&af_sorter=1&page=1';
    console.log(`📄 ページアクセス: ${targetUrl}`);
    
    await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // 少し待機してページを完全に読み込み
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('🔍 詳細構造解析実行中...');
    
    // 詳細な構造解析
    const structureAnalysis = await page.evaluate(() => {
      const result = {
        pageTitle: document.title,
        allLinks: [],
        linksByContainer: {},
        expectedCampaigns: [],
        suspiciousCampaigns: [],
        containerAnalysis: {}
      };
      
      // 楽天市場とYahoo!ショッピングの正確な検出
      const allLinks = document.querySelectorAll('a[href]');
      
      allLinks.forEach((link, index) => {
        const href = link.href;
        const text = link.textContent?.trim() || '';
        const title = link.title || '';
        const alt = link.querySelector('img')?.alt || '';
        
        // リンク情報の詳細収集
        const linkInfo = {
          index,
          href,
          text: text.slice(0, 100),
          title: title.slice(0, 100),
          alt: alt.slice(0, 100),
          hasImg: !!link.querySelector('img'),
          imgSrc: link.querySelector('img')?.src || '',
          parentClass: link.parentElement?.className || '',
          parentId: link.parentElement?.id || '',
          containerDepth: 0
        };
        
        // コンテナの深度を計算
        let container = link.parentElement;
        while (container && container !== document.body) {
          linkInfo.containerDepth++;
          container = container.parentElement;
        }
        
        // 楽天市場・Yahoo!ショッピングの正確な特定
        const isRakuten = text.includes('楽天') || title.includes('楽天') || alt.includes('楽天') || href.includes('rakuten');
        const isYahoo = text.includes('Yahoo') || text.includes('ヤフー') || title.includes('Yahoo') || alt.includes('Yahoo') || href.includes('yahoo');
        
        if (isRakuten || isYahoo) {
          result.expectedCampaigns.push({
            type: isRakuten ? '楽天市場' : 'Yahoo!ショッピング',
            ...linkInfo
          });
        }
        
        // 金融系案件の特定（現在誤取得している案件）
        const isFinancial = text.includes('アメックス') || text.includes('カード') || text.includes('証券') || text.includes('FX') ||
                           title.includes('アメックス') || title.includes('カード') || title.includes('証券') || title.includes('FX');
        
        if (isFinancial) {
          result.suspiciousCampaigns.push({
            type: '金融系（誤取得の可能性）',
            ...linkInfo
          });
        }
        
        result.allLinks.push(linkInfo);
      });
      
      // 主要なコンテナ要素の分析
      const possibleContainers = [
        '#main',
        '#content', 
        '.main-content',
        '.campaign-list',
        '.shop-list',
        '.category-list',
        '[class*="list"]',
        '[class*="item"]',
        '[class*="campaign"]',
        '[class*="shop"]'
      ];
      
      possibleContainers.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            result.containerAnalysis[selector] = {
              count: elements.length,
              firstElementContent: elements[0].textContent?.slice(0, 200) || '',
              linkCount: elements[0].querySelectorAll('a[href]').length,
              className: elements[0].className,
              id: elements[0].id
            };
          }
        } catch (e) {
          // セレクタエラーは無視
        }
      });
      
      return result;
    });
    
    // 結果の分析と表示
    console.log('\n' + '='.repeat(80));
    console.log('📊 モッピー総合通販カテゴリ構造解析結果');
    console.log('='.repeat(80));
    
    console.log(`📄 ページタイトル: ${structureAnalysis.pageTitle}`);
    console.log(`🔗 総リンク数: ${structureAnalysis.allLinks.length}件`);
    
    // 期待される正しい案件
    if (structureAnalysis.expectedCampaigns.length > 0) {
      console.log('\n✅ 期待される正しい案件:');
      structureAnalysis.expectedCampaigns.forEach((campaign, i) => {
        console.log(`  ${i + 1}. ${campaign.type}`);
        console.log(`     テキスト: "${campaign.text}"`);
        console.log(`     URL: ${campaign.href.slice(0, 80)}...`);
        console.log(`     親クラス: ${campaign.parentClass}`);
        console.log(`     コンテナ深度: ${campaign.containerDepth}`);
      });
    } else {
      console.log('\n❌ 楽天市場・Yahoo!ショッピングが見つかりません');
    }
    
    // 誤取得している金融系案件
    if (structureAnalysis.suspiciousCampaigns.length > 0) {
      console.log('\n⚠️ 誤取得されている金融系案件:');
      structureAnalysis.suspiciousCampaigns.slice(0, 5).forEach((campaign, i) => {
        console.log(`  ${i + 1}. ${campaign.text.slice(0, 50)}`);
        console.log(`     URL: ${campaign.href.slice(0, 80)}...`);
        console.log(`     親クラス: ${campaign.parentClass}`);
        console.log(`     コンテナ深度: ${campaign.containerDepth}`);
      });
    }
    
    // コンテナ分析結果
    console.log('\n🏗️ 主要コンテナ分析:');
    Object.entries(structureAnalysis.containerAnalysis).forEach(([selector, info]) => {
      if (info.linkCount > 0) {
        console.log(`  ${selector}: ${info.count}要素, ${info.linkCount}リンク`);
        console.log(`    クラス: ${info.className}`);
        console.log(`    内容: ${info.firstElementContent.slice(0, 100)}...`);
      }
    });
    
    // デバッグ用HTMLの保存
    const html = await page.content();
    const debugFile = `/Users/kn/poisoku-web/scrapers/moppy_shopping_structure_${Date.now()}.html`;
    await fs.writeFile(debugFile, html);
    console.log(`\n💾 デバッグHTML保存: ${debugFile}`);
    
    // JSON結果の保存
    const jsonFile = `/Users/kn/poisoku-web/scrapers/moppy_structure_analysis_${Date.now()}.json`;
    await fs.writeFile(jsonFile, JSON.stringify(structureAnalysis, null, 2));
    console.log(`💾 構造解析結果保存: ${jsonFile}`);
    
    console.log('\n⏱️ 10秒後にブラウザを閉じます（手動確認の時間）...');
    await new Promise(r => setTimeout(r, 10000));
    
  } catch (error) {
    console.error('❌ 調査エラー:', error);
  } finally {
    await browser.close();
  }
}

investigateMoppyStructure().catch(console.error);