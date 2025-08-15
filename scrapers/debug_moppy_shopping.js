#!/usr/bin/env node

/**
 * モッピーショッピング案件詳細調査
 * shopping/detail.phpパターンを調査
 */

const puppeteer = require('puppeteer');

async function debugMoppyShopping() {
  console.log('🔍 モッピーショッピング案件調査');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // ショッピングカテゴリのトップページ
    const testUrl = 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=80&af_sorter=1&page=1';
    
    console.log(`📄 アクセス中: ${testUrl}`);
    const response = await page.goto(testUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    console.log(`📊 ステータスコード: ${response.status()}`);
    
    // 5秒待機
    await new Promise(r => setTimeout(r, 5000));
    
    // iframeチェック
    const iframes = await page.evaluate(() => {
      const frames = document.querySelectorAll('iframe');
      return Array.from(frames).map(f => ({
        src: f.src,
        id: f.id,
        className: f.className
      }));
    });
    
    if (iframes.length > 0) {
      console.log('\n📺 iframeが検出されました:');
      iframes.forEach((frame, i) => {
        console.log(`  ${i + 1}. ${frame.src}`);
      });
    }
    
    // 案件要素の包括的な調査
    const pageData = await page.evaluate(() => {
      const result = {
        title: document.title,
        bodyClass: document.body.className,
        campaigns: [],
        sections: []
      };
      
      // セクション要素を探す
      const possibleSections = [
        'section', 'article', 'main', 
        'div[class*="list"]', 'div[class*="item"]',
        'div[class*="campaign"]', 'div[class*="offer"]',
        'ul', 'table'
      ];
      
      possibleSections.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0 && elements.length < 100) {
          elements.forEach(el => {
            const hasLinks = el.querySelectorAll('a').length;
            if (hasLinks > 0) {
              result.sections.push({
                tag: el.tagName,
                className: el.className,
                id: el.id,
                linkCount: hasLinks,
                firstLinkHref: el.querySelector('a')?.href
              });
            }
          });
        }
      });
      
      // 全リンクから案件を探す
      const links = document.querySelectorAll('a[href*="/shopping/detail.php"], a[href*="/ad/detail.php"]');
      
      links.forEach(link => {
        // 最も近い親要素から情報を収集
        let container = link.closest('li, div, article, section, tr');
        if (!container) container = link.parentElement;
        
        const campaign = {
          title: '',
          url: link.href,
          points: '',
          imgSrc: '',
          containerTag: container ? container.tagName : '',
          containerClass: container ? container.className : ''
        };
        
        // タイトル取得（複数方法）
        campaign.title = link.title || 
                        link.getAttribute('data-title') ||
                        link.querySelector('img')?.alt ||
                        link.textContent.trim();
        
        // 画像取得
        const img = link.querySelector('img') || container?.querySelector('img');
        if (img) {
          campaign.imgSrc = img.src;
          if (!campaign.title) campaign.title = img.alt;
        }
        
        // ポイント情報を探す
        if (container) {
          const containerText = container.textContent;
          // ポイントパターン
          const patterns = [
            /(\d{1,5}(?:,\d{3})*)\s*P(?![a-zA-Z])/g,
            /(\d+(?:\.\d+)?)\s*%/g,
            /(\d{1,5}(?:,\d{3})*)\s*ポイント/g
          ];
          
          patterns.forEach(pattern => {
            const match = containerText.match(pattern);
            if (match && !campaign.points) {
              campaign.points = match[0];
            }
          });
        }
        
        result.campaigns.push(campaign);
      });
      
      return result;
    });
    
    console.log(`\n📋 ページタイトル: ${pageData.title}`);
    console.log(`🎯 発見された案件数: ${pageData.campaigns.length}件`);
    
    if (pageData.campaigns.length > 0) {
      console.log('\n📦 最初の5件の詳細:');
      pageData.campaigns.slice(0, 5).forEach((c, i) => {
        console.log(`\n${i + 1}. ${c.title}`);
        console.log(`   URL: ${c.url}`);
        console.log(`   ポイント: ${c.points || '未検出'}`);
        console.log(`   コンテナ: <${c.containerTag} class="${c.containerClass}">`);
        if (c.imgSrc) console.log(`   画像: ${c.imgSrc.slice(0, 50)}...`);
      });
    }
    
    // セクション情報
    if (pageData.sections.length > 0) {
      console.log('\n📑 検出されたセクション（リンクを含む）:');
      const uniqueSections = pageData.sections
        .filter((s, i, arr) => arr.findIndex(x => x.className === s.className) === i)
        .slice(0, 10);
      
      uniqueSections.forEach(s => {
        console.log(`  <${s.tag} class="${s.className}"> - ${s.linkCount}リンク`);
      });
    }
    
    console.log('\n⏱️ 15秒後にブラウザを閉じます...');
    await new Promise(r => setTimeout(r, 15000));
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

debugMoppyShopping().catch(console.error);