import { supabase } from './supabase';
import { CampaignData, ScrapingResult } from './scraper';

export interface ScrapingLog {
  id?: string;
  site_name: string;
  search_keyword: string;
  campaigns_found: number;
  success: boolean;
  errors: string[];
  scraped_at: string;
  processing_time_ms?: number;
}

export class ScraperDatabase {
  
  // スクレイピング結果をデータベースに保存
  async saveCampaigns(results: ScrapingResult[], searchKeyword: string): Promise<{
    savedCount: number;
    updatedCount: number;
    errors: string[];
  }> {
    const response = {
      savedCount: 0,
      updatedCount: 0,
      errors: []
    };

    try {
      for (const result of results) {
        // スクレイピングログを保存
        await this.saveScrapingLog({
          site_name: result.siteName,
          search_keyword: searchKeyword,
          campaigns_found: result.data.length,
          success: result.success,
          errors: result.errors,
          scraped_at: result.scrapedAt.toISOString()
        });

        // 各案件をデータベースに保存
        for (const campaign of result.data) {
          try {
            const saved = await this.saveCampaign(campaign, result.siteName);
            if (saved.isNew) {
              response.savedCount++;
            } else {
              response.updatedCount++;
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            response.errors.push(`案件保存エラー: ${campaign.name} - ${errorMessage}`);
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      response.errors.push(`バッチ保存エラー: ${errorMessage}`);
    }

    return response;
  }

  // 個別案件をデータベースに保存または更新
  private async saveCampaign(campaign: CampaignData, siteName: string): Promise<{
    isNew: boolean;
    campaignId: string;
  }> {
    // ポイントサイトIDを取得
    let { data: pointSite } = await supabase
      .from('point_sites')
      .select('id')
      .eq('name', siteName)
      .single();

    if (!pointSite) {
      // ポイントサイトが存在しない場合は作成
      const { data: newSite, error: createError } = await supabase
        .from('point_sites')
        .insert({
          name: siteName,
          url: '',
          description: `${siteName}のポイントサイト`,
          category: 'major'
        })
        .select('id')
        .single();
      
      if (createError || !newSite) {
        throw new Error(`ポイントサイトの作成に失敗: ${siteName}`);
      }
      
      pointSite = newSite;
    }

    // 既存案件をチェック
    const { data: existing } = await supabase
      .from('campaigns')
      .select('id, cashback_rate')
      .eq('point_site_id', pointSite.id)
      .eq('name', campaign.name)
      .single();

    const campaignData = {
      point_site_id: pointSite.id,
      name: campaign.name,
      cashback_rate: campaign.cashbackRate,
      campaign_url: campaign.campaignUrl,
      description: campaign.description,
      device: campaign.device || 'All',
      category: campaign.category,
      is_active: true,
      updated_at: new Date().toISOString()
    };

    if (existing) {
      // 既存案件を更新
      const { data, error } = await supabase
        .from('campaigns')
        .update(campaignData)
        .eq('id', existing.id)
        .select('id')
        .single();

      if (error) throw error;

      // 還元率が変更された場合は履歴に記録
      if (existing.cashback_rate !== campaign.cashbackRate) {
        await this.saveCashbackHistory({
          campaign_id: existing.id,
          cashback_rate: campaign.cashbackRate,
          recorded_at: new Date().toISOString()
        });
      }

      return { isNew: false, campaignId: data.id };
    } else {
      // 新規案件を作成
      const { data, error } = await supabase
        .from('campaigns')
        .insert(campaignData)
        .select('id')
        .single();

      if (error) throw error;

      // 初回還元率を履歴に記録
      await this.saveCashbackHistory({
        campaign_id: data.id,
        cashback_rate: campaign.cashbackRate,
        recorded_at: new Date().toISOString()
      });

      return { isNew: true, campaignId: data.id };
    }
  }

  // 還元率履歴を保存
  private async saveCashbackHistory(history: {
    campaign_id: string;
    cashback_rate: string;
    recorded_at: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('cashback_history')
      .insert(history);

    if (error) {
      console.error('還元率履歴保存エラー:', error);
      throw error;
    }
  }

  // スクレイピングログを保存
  private async saveScrapingLog(log: ScrapingLog): Promise<void> {
    const { error } = await supabase
      .from('scraping_logs')
      .insert(log);

    if (error) {
      console.error('スクレイピングログ保存エラー:', error);
      // ログ保存エラーは処理を止めない
    }
  }

  // 古い案件を非アクティブ化
  async deactivateOldCampaigns(hoursOld: number = 72): Promise<number> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursOld);

    const { data, error } = await supabase
      .from('campaigns')
      .update({ is_active: false })
      .lt('updated_at', cutoffTime.toISOString())
      .eq('is_active', true)
      .select('id');

    if (error) {
      console.error('古い案件非アクティブ化エラー:', error);
      throw error;
    }

    return data?.length || 0;
  }

  // スクレイピング統計を取得
  async getScrapingStats(days: number = 7): Promise<{
    totalScrapings: number;
    successfulScrapings: number;
    totalCampaigns: number;
    averageCampaignsPerScraping: number;
    sitesStats: Array<{
      siteName: string;
      scrapings: number;
      campaigns: number;
      successRate: number;
    }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: logs, error } = await supabase
      .from('scraping_logs')
      .select('*')
      .gte('scraped_at', startDate.toISOString());

    if (error) {
      throw error;
    }

    const totalScrapings = logs.length;
    const successfulScrapings = logs.filter(log => log.success).length;
    const totalCampaigns = logs.reduce((sum, log) => sum + log.campaigns_found, 0);
    const averageCampaignsPerScraping = totalScrapings > 0 ? totalCampaigns / totalScrapings : 0;

    // サイト別統計
    const siteStats = new Map();
    logs.forEach(log => {
      const siteName = log.site_name;
      if (!siteStats.has(siteName)) {
        siteStats.set(siteName, {
          siteName,
          scrapings: 0,
          campaigns: 0,
          successfulScrapings: 0
        });
      }
      const stats = siteStats.get(siteName);
      stats.scrapings++;
      stats.campaigns += log.campaigns_found;
      if (log.success) stats.successfulScrapings++;
    });

    const sitesStats = Array.from(siteStats.values()).map(stats => ({
      ...stats,
      successRate: stats.scrapings > 0 ? (stats.successfulScrapings / stats.scrapings) * 100 : 0
    }));

    return {
      totalScrapings,
      successfulScrapings,
      totalCampaigns,
      averageCampaignsPerScraping,
      sitesStats
    };
  }

  // パターンマッチでキャンペーン削除（ダミーデータクリーンアップ用）
  async deleteCampaignsByPattern(pattern: string): Promise<{ deletedCount: number }> {
    const { data, error } = await supabase
      .from('campaigns')
      .delete()
      .ilike('name', pattern)
      .select();

    if (error) {
      console.error('キャンペーン削除エラー:', error);
      return { deletedCount: 0 };
    }

    return { deletedCount: data?.length || 0 };
  }
}