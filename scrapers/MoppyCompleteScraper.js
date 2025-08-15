#!/usr/bin/env node

/**
 * モッピー完全版スクレイパー
 * 仕様書記載の全URLに対応
 * 2025-08-14 完全版
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class MoppyCompleteScraper {
  constructor() {
    this.baseUrl = 'https://pc.moppy.jp';
    this.campaigns = [];
    this.errors = [];
    this.pageReports = [];
    this.stats = {
      totalCategories: 0,
      processedCategories: 0,
      totalCampaigns: 0,
      campaignsWithPoints: 0,
      totalPages: 0,
      pointDetectionRate: 0,
      startTime: new Date()
    };
    
    // 仕様書記載の全カテゴリURL（スマホアプリ案件を除く）
    this.allCategories = [
      // === サービス系 ===
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=51&af_sorter=1&page=', name: '金融・投資', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=128&af_sorter=1&page=', name: 'FX', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=53&af_sorter=1&page=', name: 'VISA', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=72&af_sorter=1&page=', name: 'その他投資', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=73&af_sorter=1&page=', name: '暗号資産・仮想通貨', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=176&af_sorter=1&page=', name: '不動産投資', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=168&af_sorter=1&page=', name: 'スクール', type: 'service' },
      
      // 全案件
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=2&child_category=&af_sorter=1&page=', name: '全案件', type: 'all' },
      
      // 旅行・エンタメ系
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=44&af_sorter=1&page=', name: '旅行・ホテル予約', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=43&af_sorter=1&page=', name: '宿泊', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=40&af_sorter=1&page=', name: '国内旅行', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=45&af_sorter=1&page=', name: '海外旅行', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=46&af_sorter=1&page=', name: '航空券', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=127&af_sorter=1&page=', name: 'ツアー・パック旅行', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=47&af_sorter=1&page=', name: 'レンタカー', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=41&af_sorter=1&page=', name: 'エンタメ・チケット', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=62&af_sorter=1&page=', name: 'Suica', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=42&af_sorter=1&page=', name: 'カラオケ・レジャー', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=49&af_sorter=1&page=', name: 'ビデオ・音楽', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=181&af_sorter=1&page=', name: 'サブスク・定額サービス', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=178&af_sorter=1&page=', name: '動画配信サービス', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=132&af_sorter=1&page=', name: '本・電子書籍', type: 'travel' },
      
      // 新カテゴリ（parent_category=8）
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=183&af_sorter=1&page=', name: '美容院・サロン予約', type: 'beauty' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=205&af_sorter=1&page=', name: 'エステ', type: 'beauty' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=184&af_sorter=1&page=', name: '脱毛', type: 'beauty' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=185&af_sorter=1&page=', name: '美容室・ヘアサロン', type: 'beauty' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=186&af_sorter=1&page=', name: 'マッサージ・整体', type: 'beauty' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=206&af_sorter=1&page=', name: 'ネイル', type: 'beauty' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=187&af_sorter=1&page=', name: 'ジム・フィットネス', type: 'beauty' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=188&af_sorter=1&page=', name: 'ヨガ・ピラティス', type: 'beauty' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=189&af_sorter=1&page=', name: 'まつげ・まゆげ', type: 'beauty' },
      
      // サービス追加カテゴリ
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=55&af_sorter=1&page=', name: 'JCB', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=156&af_sorter=1&page=', name: 'Mastercard', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=57&af_sorter=1&page=', name: 'ダイナースクラブカード', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=63&af_sorter=1&page=', name: 'QUICPay', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=64&af_sorter=1&page=', name: 'Smartplus', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=65&af_sorter=1&page=', name: '無料', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=179&af_sorter=1&page=', name: 'キャンペーン応募', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=68&af_sorter=1&page=', name: '無料＆即P', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=66&af_sorter=1&page=', name: '初月無料', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=207&af_sorter=1&page=', name: '無料体験', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=190&af_sorter=1&page=', name: '無料登録', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=192&af_sorter=1&page=', name: '資料請求', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=59&af_sorter=1&page=', name: 'iD', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=209&af_sorter=1&page=', name: '見積もり', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=166&af_sorter=1&page=', name: 'アンケート', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=193&af_sorter=1&page=', name: '来店', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=171&af_sorter=1&page=', name: '結婚・恋愛', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=210&af_sorter=1&page=', name: '口座開設', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=165&af_sorter=1&page=', name: '転職・求人', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=129&af_sorter=1&page=', name: 'クーポン・割引券', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=196&af_sorter=1&page=', name: '買取・査定', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=180&af_sorter=1&page=', name: '引越し', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=175&af_sorter=1&page=', name: '不動産', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=111&af_sorter=1&page=', name: '飲食店予約', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=71&af_sorter=1&page=', name: 'その他乗り物', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=58&af_sorter=1&page=', name: '楽天Edy', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=211&af_sorter=1&page=', name: '光回線・格安SIM', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=194&af_sorter=1&page=', name: 'ライフライン', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=197&af_sorter=1&page=', name: '回線開通', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=191&af_sorter=1&page=', name: '格安スマホ・SIM', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=133&af_sorter=1&page=', name: 'インターネット回線', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=212&af_sorter=1&page=', name: 'WiFi・モバイルルーター', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=167&af_sorter=1&page=', name: '電気・ガス', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=214&af_sorter=1&page=', name: '宅配クリーニング', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=130&af_sorter=1&page=', name: 'その他', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=198&af_sorter=1&page=', name: '口コミ投稿', type: 'service' },
      
      // ゲーム系
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=74&af_sorter=1&page=', name: 'ブラウザゲーム', type: 'game' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=75&af_sorter=1&page=', name: 'RPG', type: 'game' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=76&af_sorter=1&page=', name: 'アクション', type: 'game' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=77&af_sorter=1&page=', name: 'シミュレーション', type: 'game' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=78&af_sorter=1&page=', name: 'スポーツゲーム', type: 'game' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=79&af_sorter=1&page=', name: 'パズル・クイズ', type: 'game' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=131&af_sorter=1&page=', name: 'オンラインゲーム', type: 'game' },
      
      // === ショッピング系 ===
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=80&af_sorter=1&page=', name: '総合通販', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=143&af_sorter=1&page=', name: 'デパート・百貨店', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=195&af_sorter=1&page=', name: 'ふるさと納税', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=86&af_sorter=1&page=', name: 'ベビー・キッズ・マタニティ', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=107&af_sorter=1&page=', name: 'おもちゃ・ホビー', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=159&af_sorter=1&page=', name: 'ゲーム', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=90&af_sorter=1&page=', name: '化粧品・スキンケア', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=199&af_sorter=1&page=', name: 'コスメ・メイク', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=89&af_sorter=1&page=', name: '健康食品', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=136&af_sorter=1&page=', name: 'サプリメント', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=92&af_sorter=1&page=', name: 'ヘアケア', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=138&af_sorter=1&page=', name: 'ボディケア', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=160&af_sorter=1&page=', name: 'ダイエット', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=200&af_sorter=1&page=', name: 'コンタクトレンズ', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=201&af_sorter=1&page=', name: '医薬品・医療', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=109&af_sorter=1&page=', name: 'デリバリー・宅配', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=137&af_sorter=1&page=', name: 'プレゼント・ギフト', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=162&af_sorter=1&page=', name: '限定商品', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=163&af_sorter=1&page=', name: '定期購入', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=81&af_sorter=1&page=', name: 'レディースファッション', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=85&af_sorter=1&page=', name: 'インナー・下着・ナイトウェア', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=82&af_sorter=1&page=', name: 'メンズファッション', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=174&af_sorter=1&page=', name: 'ファッション', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=83&af_sorter=1&page=', name: 'バッグ・小物・ブランド雑貨', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=84&af_sorter=1&page=', name: '靴', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=108&af_sorter=1&page=', name: 'ジュエリー・腕時計', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=95&af_sorter=1&page=', name: '家電', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=96&af_sorter=1&page=', name: 'カメラ', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=97&af_sorter=1&page=', name: 'PC・タブレット', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=98&af_sorter=1&page=', name: 'スマートフォン・携帯電話', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=101&af_sorter=1&page=', name: '家具・インテリア', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=103&af_sorter=1&page=', name: 'キッチン・日用品・文具', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=87&af_sorter=1&page=', name: '食品', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=88&af_sorter=1&page=', name: 'ドリンク・お酒', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=177&af_sorter=1&page=', name: 'スイーツ・お菓子', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=93&af_sorter=1&page=', name: 'スポーツ', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=164&af_sorter=1&page=', name: 'ゴルフ', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=94&af_sorter=1&page=', name: 'アウトドア', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=161&af_sorter=1&page=', name: 'レジャー・体験', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=99&af_sorter=1&page=', name: 'CD・DVD', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=141&af_sorter=1&page=', name: '楽器', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=142&af_sorter=1&page=', name: '手芸・クラフト', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=140&af_sorter=1&page=', name: '占い', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=202&af_sorter=1&page=', name: 'お悩み相談', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=104&af_sorter=1&page=', name: 'ペット用品・生き物', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=102&af_sorter=1&page=', name: '花・ガーデニング', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=105&af_sorter=1&page=', name: '車・カー用品', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=144&af_sorter=1&page=', name: 'バイク・バイク用品', type: 'shopping' }
    ];
    
    this.stats.totalCategories = this.allCategories.length;
  }

  /**
   * メイン実行関数
   */
  async execute() {
    console.log('🎯 モッピー完全版スクレイパー起動');
    console.log('='.repeat(80));
    console.log('📋 仕様書記載の全URL対応版');
    console.log(`📊 対象カテゴリ数: ${this.allCategories.length}カテゴリ`);
    console.log('='.repeat(80));

    let browser;
    try {
      browser = await this.launchOptimizedBrowser();
      
      // カテゴリごとに処理
      for (const [index, category] of this.allCategories.entries()) {
        console.log(`\n[${index + 1}/${this.allCategories.length}] 処理中...`);
        
        // Protocol error回避のため、定期的にブラウザを再起動
        if (index > 0 && index % 20 === 0) {
          console.log('🔄 ブラウザ再起動（安定性維持）...');
          await browser.close();
          await this.sleep(3000);
          browser = await this.launchOptimizedBrowser();
        }
        
        await this.processCategoryWithPagination(browser, category, index + 1);
        await this.sleep(1000);
      }
      
      // 統計計算
      this.stats.pointDetectionRate = this.stats.campaignsWithPoints / this.stats.totalCampaigns;
      
      await this.saveResults();
      this.generateDetailedReport();
      
    } catch (error) {
      console.error('💥 致命的エラー:', error);
      this.errors.push({
        type: 'FATAL',
        message: error.message
      });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * 最適化ブラウザ起動
   */
  async launchOptimizedBrowser() {
    console.log('🚀 最適化ブラウザ起動中...');
    
    return await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      defaultViewport: { width: 1920, height: 1080 },
      protocolTimeout: 120000 // タイムアウトを延長
    });
  }

  /**
   * ページネーション対応カテゴリ処理
   */
  async processCategoryWithPagination(browser, category, categoryNumber) {
    console.log(`📂 カテゴリ${categoryNumber}: ${category.name}`);
    
    let currentPage = 1;
    let hasMorePages = true;
    let categoryTotalCampaigns = 0;
    let categoryPages = [];
    let consecutiveEmptyPages = 0;
    const maxEmptyPages = 3; // 連続3ページ空なら終了
    const maxPages = 200; // 最大ページ数制限
    
    while (hasMorePages && currentPage <= maxPages) {
      const pageUrl = `${category.baseUrl}${currentPage}`;
      
      const page = await browser.newPage();
      
      try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        await this.sleep(2000);
        
        // 案件抽出
        const campaigns = await this.extractMainContentCampaigns(page, category, currentPage);
        
        if (campaigns.length > 0) {
          consecutiveEmptyPages = 0; // リセット
          this.campaigns.push(...campaigns);
          categoryTotalCampaigns += campaigns.length;
          
          // ポイント検出数をカウント
          const withPoints = campaigns.filter(c => c.points && c.points !== '').length;
          this.stats.campaignsWithPoints += withPoints;
          
          // ページ別レポートに記録
          const pageReport = {
            categoryNumber,
            categoryName: category.name,
            categoryType: category.type,
            pageNumber: currentPage,
            campaignCount: campaigns.length,
            campaignsWithPoints: withPoints,
            url: pageUrl
          };
          
          categoryPages.push(pageReport);
          this.pageReports.push(pageReport);
          
          console.log(`  📄 ページ${currentPage}: ${campaigns.length}件取得 (ポイント情報: ${withPoints}件)`);
          
          currentPage++;
          
        } else {
          consecutiveEmptyPages++;
          
          if (consecutiveEmptyPages >= maxEmptyPages) {
            hasMorePages = false;
            console.log(`  🏁 ${maxEmptyPages}ページ連続で案件なし。処理終了`);
          } else {
            console.log(`  ⚠️ ページ${currentPage}: 案件なし (${consecutiveEmptyPages}/${maxEmptyPages})`);
            currentPage++;
          }
        }
        
      } catch (error) {
        console.error(`  ❌ ページ${currentPage}エラー: ${error.message}`);
        this.errors.push({
          category: category.name,
          page: currentPage,
          error: error.message
        });
        consecutiveEmptyPages++;
        
        if (consecutiveEmptyPages >= maxEmptyPages) {
          hasMorePages = false;
        } else {
          currentPage++;
        }
      } finally {
        await page.close();
      }
      
      await this.sleep(500);
    }
    
    this.stats.totalCampaigns += categoryTotalCampaigns;
    this.stats.totalPages += categoryPages.length;
    this.stats.processedCategories++;
    
    console.log(`  📊 ${category.name}完了: ${categoryTotalCampaigns}件 (${categoryPages.length}ページ)`);
  }

  /**
   * メインコンテンツエリアからの案件抽出
   */
  async extractMainContentCampaigns(page, category, pageNumber) {
    return await page.evaluate((categoryInfo, pageNum) => {
      const campaigns = new Map();
      
      // メインコンテンツエリアの特定
      const mainContentItems = document.querySelectorAll('.m-list__item');
      
      mainContentItems.forEach(container => {
        // 除外エリアチェック
        if (container.closest('.m-trending-words__list-item') ||
            container.closest('.m-trending-words')) {
          return;
        }
        
        // 案件リンクの抽出
        const links = container.querySelectorAll('a[href]');
        
        links.forEach(link => {
          const href = link.href;
          
          if (href.includes('/shopping/detail.php') || 
              href.includes('/ad/detail.php')) {
            
            if (href.includes('track_ref=tw')) {
              return;
            }
            
            const siteIdMatch = href.match(/site_id=(\d+)/);
            const siteId = siteIdMatch ? siteIdMatch[1] : null;
            
            if (siteId && !campaigns.has(siteId)) {
              const campaign = {
                id: `moppy_${siteId}`,
                url: href,
                title: '',
                points: '',
                pageNumber: pageNum
              };
              
              // タイトル取得
              campaign.title = link.title || 
                              link.getAttribute('data-title') ||
                              link.getAttribute('alt');
              
              const img = link.querySelector('img');
              if (img && !campaign.title) {
                campaign.title = img.alt || img.title;
              }
              
              if (!campaign.title) {
                const linkText = link.textContent.trim();
                if (linkText && linkText.length > 0 && linkText.length < 200) {
                  campaign.title = linkText.replace(/\s+/g, ' ').trim();
                }
              }
              
              // ポイント情報の抽出
              const containerText = container.textContent || '';
              const pointPatterns = [
                /(\d{1,6}(?:,\d{3})*)(?:\s*)([PpＰ])/,
                /(\d+(?:\.\d+)?)(?:\s*)([%％])/,
                /(\d{1,6}(?:,\d{3})*)(?:\s*)円相当/,
                /最大(?:\s*)(\d{1,6}(?:,\d{3})*)/
              ];
              
              for (const pattern of pointPatterns) {
                const match = containerText.match(pattern);
                if (match) {
                  campaign.points = match[0];
                  break;
                }
              }
              
              if (campaign.title && campaign.title.length > 0) {
                campaigns.set(siteId, campaign);
              }
            }
          }
        });
      });
      
      // 結果の整形
      const results = [];
      campaigns.forEach(campaign => {
        results.push({
          ...campaign,
          category: categoryInfo.name,
          categoryType: categoryInfo.type,
          device: 'All',
          scrapedAt: new Date().toISOString()
        });
      });
      
      return results;
    }, category, pageNumber);
  }

  /**
   * 結果保存
   */
  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `moppy_complete_${timestamp}.json`;
    const filepath = path.join(__dirname, 'data', 'moppy', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const output = {
      scrapeDate: new Date().toISOString(),
      version: '7.0.0',
      systemType: 'moppy_complete_scraper',
      description: '仕様書完全対応版',
      stats: {
        totalCampaigns: this.campaigns.length,
        campaignsWithPoints: this.stats.campaignsWithPoints,
        pointDetectionRate: Math.round(this.stats.pointDetectionRate * 100),
        totalCategories: this.stats.processedCategories,
        totalPages: this.stats.totalPages,
        executionTime: Math.round((new Date() - this.stats.startTime) / 1000),
        errors: this.errors.length
      },
      pageReports: this.pageReports,
      campaigns: this.campaigns,
      errors: this.errors
    };
    
    await fs.writeFile(filepath, JSON.stringify(output, null, 2));
    console.log(`\n💾 保存完了: ${filename}`);
  }

  /**
   * 詳細レポート生成
   */
  generateDetailedReport() {
    const executionTime = Math.round((new Date() - this.stats.startTime) / 1000);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 モッピー完全版スクレイピング完了レポート');
    console.log('='.repeat(80));
    console.log(`✅ 総取得案件数: ${this.campaigns.length}件`);
    console.log(`💰 ポイント情報取得: ${this.stats.campaignsWithPoints}件`);
    console.log(`📈 ポイント検出率: ${Math.round(this.stats.pointDetectionRate * 100)}%`);
    console.log(`📂 処理カテゴリ: ${this.stats.processedCategories}/${this.stats.totalCategories}`);
    console.log(`📄 総ページ数: ${this.stats.totalPages}ページ`);
    console.log(`⏱️ 実行時間: ${executionTime}秒`);
    console.log(`❌ エラー数: ${this.errors.length}件`);
    
    // カテゴリタイプ別統計
    const typeStats = {};
    this.pageReports.forEach(report => {
      if (!typeStats[report.categoryType]) {
        typeStats[report.categoryType] = {
          categories: new Set(),
          campaigns: 0,
          pages: 0
        };
      }
      typeStats[report.categoryType].categories.add(report.categoryName);
      typeStats[report.categoryType].campaigns += report.campaignCount;
      typeStats[report.categoryType].pages++;
    });
    
    console.log('\n📊 カテゴリタイプ別統計:');
    console.log('='.repeat(80));
    Object.entries(typeStats).forEach(([type, stats]) => {
      console.log(`${type}: ${stats.categories.size}カテゴリ, ${stats.campaigns}件, ${stats.pages}ページ`);
    });
    
    // カテゴリ別統計サマリー（主要なもののみ）
    const categoryStats = {};
    this.pageReports.forEach(report => {
      if (!categoryStats[report.categoryName]) {
        categoryStats[report.categoryName] = {
          totalCampaigns: 0,
          totalPages: 0,
          campaignsWithPoints: 0
        };
      }
      categoryStats[report.categoryName].totalCampaigns += report.campaignCount;
      categoryStats[report.categoryName].totalPages++;
      categoryStats[report.categoryName].campaignsWithPoints += report.campaignsWithPoints;
    });
    
    console.log('\n📊 主要カテゴリ統計（上位10カテゴリ）:');
    console.log('='.repeat(80));
    const sortedCategories = Object.entries(categoryStats)
      .sort((a, b) => b[1].totalCampaigns - a[1].totalCampaigns)
      .slice(0, 10);
    
    sortedCategories.forEach(([category, stats]) => {
      console.log(`${category}: ${stats.totalCampaigns}件 (${stats.totalPages}ページ, ポイント付き: ${stats.campaignsWithPoints}件)`);
    });
  }

  /**
   * スリープ関数
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 実行
if (require.main === module) {
  const scraper = new MoppyCompleteScraper();
  scraper.execute().catch(console.error);
}

module.exports = MoppyCompleteScraper;