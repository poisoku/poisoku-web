import { ScraperDatabase } from './scraperDb';

export interface APIFeedCampaign {
  id?: string;
  name: string;
  cashback_rate: string;
  point_site: string;
  campaign_url: string;
  description?: string;
  category: string;
  device?: string;
  created_at?: string;
  updated_at?: string;
}

export interface APIFeedResult {
  success: boolean;
  source: string;
  campaigns: APIFeedCampaign[];
  errors: string[];
  stats: {
    totalImported: number;
    totalSaved: number;
    totalUpdated: number;
    processingTimeMs: number;
    format: string;
  };
}

export class APIFeedImporter {
  private scraperDb: ScraperDatabase;

  constructor() {
    this.scraperDb = new ScraperDatabase();
  }

  // API/フィードからデータをインポート
  async importFromFeed(feedUrl: string, format: 'json' | 'csv' | 'tsv' = 'json'): Promise<APIFeedResult> {
    const startTime = Date.now();
    const result: APIFeedResult = {
      success: false,
      source: feedUrl,
      campaigns: [],
      errors: [],
      stats: {
        totalImported: 0,
        totalSaved: 0,
        totalUpdated: 0,
        processingTimeMs: 0,
        format
      }
    };

    try {
      console.log(`📡 API/フィードからデータインポート開始...`);
      console.log(`   URL: ${feedUrl}`);
      console.log(`   形式: ${format.toUpperCase()}`);

      // フィードデータ取得
      const response = await fetch(feedUrl);
      if (!response.ok) {
        throw new Error(`フィード取得エラー: ${response.status} ${response.statusText}`);
      }

      let campaigns: APIFeedCampaign[] = [];

      // フォーマットに応じた解析
      if (format === 'json') {
        const data = await response.json();
        campaigns = data.data || data.campaigns || data;
        if (!Array.isArray(campaigns)) {
          throw new Error('JSONデータが配列形式ではありません');
        }
      } else if (format === 'csv') {
        const text = await response.text();
        campaigns = this.parseCSV(text);
      } else if (format === 'tsv') {
        const text = await response.text();
        campaigns = this.parseTSV(text);
      }

      result.campaigns = campaigns;
      result.stats.totalImported = campaigns.length;
      
      console.log(`📊 ${campaigns.length}件の案件を取得`);

      // データベースに保存
      if (campaigns.length > 0) {
        const saveResult = await this.saveCampaigns(campaigns);
        result.stats.totalSaved = saveResult.savedCount;
        result.stats.totalUpdated = saveResult.updatedCount;
        result.errors.push(...saveResult.errors);
        
        console.log(`💾 保存完了: 新規${saveResult.savedCount}件, 更新${saveResult.updatedCount}件`);
      }

      result.success = true;
      result.stats.processingTimeMs = Date.now() - startTime;

      console.log(`✅ インポート完了 (${(result.stats.processingTimeMs / 1000).toFixed(1)}秒)`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('API/フィードインポートエラー:', error);
      result.errors.push(`インポートエラー: ${errorMessage}`);
    }

    return result;
  }

  // CSV解析
  private parseCSV(text: string): APIFeedCampaign[] {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const campaigns: APIFeedCampaign[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(".*?"|[^,]+)/g) || [];
      const campaign: any = {};

      headers.forEach((header, index) => {
        if (values[index]) {
          campaign[header] = values[index].replace(/"/g, '').trim();
        }
      });

      if (campaign.name && campaign.cashback_rate) {
        campaigns.push(campaign as APIFeedCampaign);
      }
    }

    return campaigns;
  }

  // TSV解析
  private parseTSV(text: string): APIFeedCampaign[] {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t');
    const campaigns: APIFeedCampaign[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const campaign: any = {};

      headers.forEach((header, index) => {
        if (values[index]) {
          campaign[header] = values[index].trim();
        }
      });

      if (campaign.name && campaign.cashback_rate) {
        campaigns.push(campaign as APIFeedCampaign);
      }
    }

    return campaigns;
  }

  // キャンペーンデータをデータベースに保存
  private async saveCampaigns(campaigns: APIFeedCampaign[]): Promise<{
    savedCount: number;
    updatedCount: number;
    errors: string[];
  }> {
    // 正規化とデータ変換
    const normalizedData = campaigns.map(campaign => ({
      name: campaign.name,
      cashbackRate: this.normalizeCashbackRate(campaign.cashback_rate),
      pointSiteName: campaign.point_site,
      campaignUrl: campaign.campaign_url,
      description: campaign.description || campaign.name,
      device: campaign.device || 'All',
      category: campaign.category || 'other'
    }));

    // バッチ保存
    const saveResults = [{
      siteName: campaigns[0]?.point_site || 'API Feed',
      success: true,
      data: normalizedData,
      errors: [],
      scrapedAt: new Date()
    }];

    return await this.scraperDb.saveCampaigns(saveResults, 'api-feed-import');
  }

  // 還元率の正規化
  private normalizeCashbackRate(rate: string): string {
    if (!rate) return '0円';
    
    // 既に正規化されている場合はそのまま返す
    if (rate.endsWith('円') || rate.endsWith('%')) {
      return rate;
    }
    
    // ポイント表記の場合は円に変換
    if (rate.includes('P') || rate.includes('ポイント')) {
      const match = rate.match(/[\d,]+/);
      if (match) {
        const points = parseInt(match[0].replace(/,/g, ''));
        return `${points.toLocaleString()}円`;
      }
    }
    
    return rate;
  }

  // ダミーデータのクリーンアップ
  async cleanupDummyData(): Promise<{
    success: boolean;
    deletedCount: number;
    error?: string;
  }> {
    try {
      console.log('🧹 ダミーデータのクリーンアップ開始...');
      
      // ダミーデータを識別して削除（名前に"テスト案件"や"DUMMY"を含むもの）
      const result = await this.scraperDb.deleteCampaignsByPattern('%テスト案件%API%');
      
      console.log(`✅ ${result.deletedCount}件のダミーデータを削除しました`);
      
      return {
        success: true,
        deletedCount: result.deletedCount
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('ダミーデータクリーンアップエラー:', error);
      
      return {
        success: false,
        deletedCount: 0,
        error: errorMessage
      };
    }
  }
}