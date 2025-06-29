import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 追加するポイントサイトのリスト
const newPointSites = [
  { name: '.money', url: 'https://money.rakuten.co.jp/', description: '楽天グループのポイントサイト', category: 'major' },
  { name: 'COINCOME', url: 'https://coincome.jp/', description: 'スマホ特化のポイントサイト', category: 'gaming' },
  { name: 'dジョブ スマホワーク', url: 'https://djob.docomo.ne.jp/', description: 'ドコモのポイントサイト', category: 'survey' },
  { name: 'dポイントマーケット', url: 'https://dpoint.jp/', description: 'dポイントが貯まるサイト', category: 'cashback' },
  { name: 'ECナビ', url: 'https://ecnavi.jp/', description: '老舗のポイントサイト', category: 'major' },
  { name: 'GetMoney!', url: 'https://getmoney.jp/', description: '高還元のポイントサイト', category: 'major' },
  { name: 'GMOポイ活', url: 'https://gmo-poikatsu.com/', description: 'GMOグループのポイントサイト', category: 'major' },
  { name: 'Gポイント', url: 'https://gpoint.co.jp/', description: 'ポイント交換サイト', category: 'major' },
  { name: 'MIKOSHI', url: 'https://mikoshi.jp/', description: 'ゲーム系ポイントサイト', category: 'gaming' },
  { name: 'MIKOSHIモール', url: 'https://mikoshi-mall.jp/', description: 'MIKOSHIのショッピングモール', category: 'cashback' },
  { name: 'PONEY', url: 'https://poney.net/', description: '高還元率のポイントサイト', category: 'major' },
  { name: 'Powl', url: 'https://powl.jp/', description: 'アンケート特化サイト', category: 'survey' },
  { name: 'Pontaボーナスパーク', url: 'https://bonuspark.ponta.jp/', description: 'Pontaポイントが貯まる', category: 'cashback' },
  { name: 'QuickPoint', url: 'https://quickpoint.jp/', description: 'クイック系ポイントサイト', category: 'major' },
  { name: 'Rebates', url: 'https://rebates.jp/', description: '楽天Rebates', category: 'cashback' },
  { name: 'Vポイントモール', url: 'https://vpoint-mall.com/', description: 'Vポイントが貯まるモール', category: 'cashback' },
  { name: 'アプリdeたま～る', url: 'https://apps-tamaru.com/', description: 'アプリダウンロード特化', category: 'gaming' },
  { name: 'アメフリ', url: 'https://amefri.com/', description: 'アメーバのポイントサイト', category: 'major' },
  { name: 'アルテマ', url: 'https://altema-point.com/', description: 'ゲーム攻略サイトのポイント版', category: 'gaming' },
  { name: 'えんためねっと', url: 'https://entamenet.jp/', description: 'エンタメ特化ポイントサイト', category: 'major' },
  { name: 'クラシルリワード', url: 'https://kurashiru-reward.com/', description: 'クラシル公式ポイントサイト', category: 'cashback' },
  { name: 'げん玉', url: 'https://gendama.jp/', description: '老舗の大手ポイントサイト', category: 'major' },
  { name: 'ジョブ太のアプリ広場', url: 'https://jobta-apps.com/', description: 'アプリ系ポイントサイト', category: 'gaming' },
  { name: 'すぐたま', url: 'https://sugutama.jp/', description: 'ネットマイル系ポイントサイト', category: 'major' },
  { name: 'タウンdeアプリ', url: 'https://town-apps.com/', description: 'アプリダウンロード特化', category: 'gaming' },
  { name: 'タウンde即ゲット', url: 'https://town-sokuget.com/', description: '即日ポイント獲得サイト', category: 'major' },
  { name: 'たまるモール', url: 'https://tamaru-mall.com/', description: 'ショッピングモール系', category: 'cashback' },
  { name: 'チャンスイット', url: 'https://chanceit.jp/', description: '懸賞・ポイントサイト', category: 'major' },
  { name: 'ちょびリッチ', url: 'https://chobirich.com/', description: '老舗のポイントサイト', category: 'major' },
  { name: 'トリマ', url: 'https://trip-mile.com/', description: '移動でポイントが貯まる', category: 'gaming' },
  { name: 'ニフティポイントクラブ', url: 'https://point.nifty.com/', description: 'ニフティのポイントサイト', category: 'major' },
  { name: 'ハピタス', url: 'https://hapitas.jp/', description: '人気の高還元ポイントサイト', category: 'major' },
  { name: 'バリューポイントクラブ', url: 'https://value-point.com/', description: 'バリュー系ポイントサイト', category: 'major' },
  { name: 'フルーツメール', url: 'https://fruitmail.net/', description: 'メール受信でポイント', category: 'survey' },
  { name: 'ポイントインカム', url: 'https://pointi.jp/', description: '高還元で人気のサイト', category: 'major' },
  { name: 'ポイントタウン', url: 'https://pointtown.com/', description: 'GMO系の大手サイト', category: 'major' },
  { name: 'ポイントダンジョン', url: 'https://point-dungeon.com/', description: 'ゲーム系ポイントサイト', category: 'gaming' },
  { name: 'ポイントダンジョン2', url: 'https://point-dungeon2.com/', description: 'ポイントダンジョンの新版', category: 'gaming' },
  { name: 'ポイント広場', url: 'https://point-hiroba.com/', description: 'ポイント総合サイト', category: 'major' },
  { name: 'ポンタちゃれんじ', url: 'https://ponta-challenge.com/', description: 'Pontaポイント特化', category: 'gaming' },
  { name: 'ポケマNet', url: 'https://pokema.net/', description: 'ポケット系ポイントサイト', category: 'major' },
  { name: 'メルカリ', url: 'https://mercari.com/', description: 'フリマアプリ', category: 'cashback' },
  { name: 'モッピー', url: 'https://moppy.jp/', description: '国内最大級のポイントサイト', category: 'major' },
  { name: 'やったよ.ねっと', url: 'https://yattayo.net/', description: 'アクション系ポイントサイト', category: 'gaming' },
  { name: '楽天スーパーポイントギャラリー', url: 'https://point.rakuten.co.jp/', description: '楽天ポイント特化サイト', category: 'cashback' },
  { name: '楽天ポイントモール', url: 'https://pointmall.rakuten.co.jp/', description: '楽天ポイントモール', category: 'cashback' },
  { name: 'ワラウ', url: 'https://warau.jp/', description: '老舗のポイントサイト', category: 'major' }
];

export async function POST() {
  try {
    console.log('🌟 新しいポイントサイト追加開始...');

    // 既存のポイントサイト名を取得
    const { data: existingSites, error: fetchError } = await supabase
      .from('point_sites')
      .select('name');

    if (fetchError) {
      throw fetchError;
    }

    const existingNames = new Set(existingSites?.map(site => site.name) || []);
    
    // 新しいサイトのみフィルタリング
    const sitesToAdd = newPointSites.filter(site => !existingNames.has(site.name));

    if (sitesToAdd.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'すべてのポイントサイトは既に登録済みです',
        addedCount: 0
      });
    }

    // バッチでポイントサイトを追加
    const { data, error } = await supabase
      .from('point_sites')
      .insert(sitesToAdd.map(site => ({
        name: site.name,
        url: site.url,
        description: site.description,
        category: site.category,
        is_active: true
      })));

    if (error) {
      throw error;
    }

    console.log(`✅ ${sitesToAdd.length}件の新しいポイントサイトを追加`);

    return NextResponse.json({
      success: true,
      addedCount: sitesToAdd.length,
      addedSites: sitesToAdd.map(site => site.name),
      message: `${sitesToAdd.length}件の新しいポイントサイトを追加しました`
    });

  } catch (error) {
    console.error('ポイントサイト追加エラー:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ポイントサイト追加エラー' },
      { status: 500 }
    );
  }
}