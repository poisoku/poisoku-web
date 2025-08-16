#!/usr/bin/env node

/**
 * 実際のモバイル版レイアウト分析
 * ユーザーのスクリーンショットと比較
 */

const puppeteer = require('puppeteer');

async function analyzeRealMobileLayout() {
  console.log('🔍 実際のモバイル版レイアウト分析開始...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // 最新のiOS設定
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1');
    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    });
    
    const targetUrl = 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=52&af_sorter=1&page=1';
    console.log(`📱 アクセス中: ${targetUrl}`);
    
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 包括的なページ分析
    const analysis = await page.evaluate(() => {
      const result = {
        // 基本情報
        title: document.title,
        url: window.location.href,
        
        // ページネーション完全分析
        paginationFullText: '',
        paginationNumbers: [],
        
        // 全app関連案件を詳細取得
        appCampaigns: [],
        
        // レイアウト情報
        layoutInfo: {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          bodyWidth: document.body.offsetWidth,
          bodyHeight: document.body.offsetHeight
        },
        
        // 全site_idリンクの詳細
        allSiteIdLinks: []
      };
      
      // ページネーション情報の完全抽出
      const bodyText = document.body.textContent;
      const paginationPatterns = [
        /(\d+)\s*-\s*(\d+)を表示\s*\/\s*(\d+)件中/g,
        /(\d+)\s*～\s*(\d+)\s*\/\s*(\d+)件/g,
        /表示\s*(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)/g
      ];
      
      for (const pattern of paginationPatterns) {
        const matches = [...bodyText.matchAll(pattern)];
        if (matches.length > 0) {
          result.paginationFullText = matches[0][0];
          break;
        }
      }
      
      // ページ番号ボタンの取得
      const pageElements = document.querySelectorAll('a, button, span');
      pageElements.forEach(elem => {
        const text = elem.textContent?.trim();
        if (/^[1-9]\d*$/.test(text) && parseInt(text) <= 20) {
          result.paginationNumbers.push({
            number: parseInt(text),
            isActive: elem.classList.contains('active') || 
                     elem.classList.contains('current') || 
                     elem.classList.contains('a-pagination--active'),
            className: elem.className,
            tagName: elem.tagName
          });
        }
      });
      
      // 全site_idリンクの詳細分析
      const siteIdLinks = document.querySelectorAll('a[href*="site_id"]');
      siteIdLinks.forEach((link, index) => {
        const container = link.closest('div, li, section, article, tr') || link.parentElement;
        
        // タイトル取得（複数方法）
        let title = '';
        const strongEl = link.querySelector('strong') || container.querySelector('strong');
        if (strongEl) {
          title = strongEl.textContent?.trim() || '';
        }
        if (!title) {
          title = link.textContent?.trim() || '';
        }
        if (!title && container) {
          const textContent = container.textContent || '';
          const lines = textContent.split('\n').filter(line => line.trim().length > 3);
          title = lines[0]?.trim() || '';
        }
        
        // ポイント情報取得
        let points = '';
        const containerText = container ? container.textContent : link.textContent;
        const pointPatterns = [
          /(\d{1,3}(?:,\d{3})*)(?:P|ポイント)/i,
          /(\d{1,3}(?:,\d{3})*)円/i,
          /(\d+(?:\.\d+)?)%/i
        ];
        
        for (const pattern of pointPatterns) {
          const match = containerText.match(pattern);
          if (match) {
            points = match[0];
            break;
          }
        }
        
        // アプリキーワード判定
        const appKeywords = [
          'アプリ', 'インストール', '新規アプリ', 'ダウンロード',
          'iOS', 'Android', '初回起動', 'Ponta', 'ローソン', 
          'TikTok', 'メルカリ', 'CokeON', 'ピッコマ', '三國志'
        ];
        
        const isAppCampaign = appKeywords.some(keyword => 
          title.toLowerCase().includes(keyword.toLowerCase()) ||
          containerText.toLowerCase().includes(keyword.toLowerCase())
        );
        
        // 要素の可視性
        const rect = link.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && 
                         window.getComputedStyle(link).display !== 'none';
        
        const linkData = {
          index: index + 1,
          title: title.substring(0, 150),
          points: points,
          url: link.href,
          isAppCampaign: isAppCampaign,
          isVisible: isVisible,
          position: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          parentTag: container ? container.tagName : '',
          parentClass: container ? container.className : ''
        };
        
        result.allSiteIdLinks.push(linkData);
        
        if (isAppCampaign) {
          result.appCampaigns.push(linkData);
        }
      });
      
      return result;
    });
    
    console.log('\n📊 詳細分析結果:');
    console.log(`📄 タイトル: ${analysis.title}`);
    console.log(`🔗 URL: ${analysis.url}`);
    console.log(`📱 ビューポート: ${analysis.layoutInfo.viewportWidth}x${analysis.layoutInfo.viewportHeight}`);
    console.log(`📈 ページネーション: ${analysis.paginationFullText || '見つかりません'}`);
    
    if (analysis.paginationNumbers.length > 0) {
      console.log('\n📄 ページ番号:');
      analysis.paginationNumbers.forEach(page => {
        const active = page.isActive ? ' ★現在のページ' : '';
        console.log(`  ${page.number}${active} [${page.tagName}.${page.className}]`);
      });
    }
    
    console.log(`\n🔗 全site_idリンク: ${analysis.allSiteIdLinks.length}件`);
    console.log(`📱 アプリ案件: ${analysis.appCampaigns.length}件`);
    
    console.log('\n📋 アプリ案件詳細:');
    analysis.appCampaigns.forEach(campaign => {
      const visible = campaign.isVisible ? '✅' : '❌';
      console.log(`  ${campaign.index}. ${visible} ${campaign.title} [${campaign.points}]`);
      console.log(`     位置: (${Math.round(campaign.position.x)}, ${Math.round(campaign.position.y)}) ${Math.round(campaign.position.width)}x${Math.round(campaign.position.height)}`);
    });
    
    console.log('\n📋 全site_idリンク一覧（最初の20件）:');
    analysis.allSiteIdLinks.slice(0, 20).forEach(link => {
      const visible = link.isVisible ? '✅' : '❌';
      const app = link.isAppCampaign ? '📱' : '🌐';
      console.log(`  ${link.index}. ${visible}${app} ${link.title} [${link.points}]`);
    });
    
    // ページネーション情報が取得できているかチェック
    if (analysis.paginationFullText) {
      const match = analysis.paginationFullText.match(/(\d+)\s*-\s*(\d+)を表示\s*\/\s*(\d+)件中/);
      if (match) {
        const [, start, end, total] = match;
        console.log(`\n🎯 ページネーション解析成功:`);
        console.log(`   表示範囲: ${start} - ${end}`);
        console.log(`   総件数: ${total}件`);
        console.log(`   1ページあたり: ${parseInt(end) - parseInt(start) + 1}件`);
        
        if (parseInt(total) === 263) {
          console.log('✅ ユーザーのスクリーンショットと一致！');
        }
      }
    }
    
    return analysis;
    
  } catch (error) {
    console.error('💥 分析エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
analyzeRealMobileLayout().catch(console.error);