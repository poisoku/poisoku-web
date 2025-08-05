const fs = require('fs').promises;
const path = require('path');

/**
 * データベース管理クラス
 * Supabase（PostgreSQL）とローカルファイルの両方に対応
 */
class DatabaseManager {
  constructor(options = {}) {
    this.supabaseUrl = options.supabaseUrl || process.env.SUPABASE_URL;
    this.supabaseKey = options.supabaseKey || process.env.SUPABASE_ANON_KEY;
    this.useDatabase = options.useDatabase !== false; // デフォルトはtrue
    this.backupDir = options.backupDir || path.join(__dirname, '../../data/backups');
    this.tableName = options.tableName || 'chobirich_campaigns';
    
    this.supabase = null;
    
    // 統計情報
    this.stats = {
      inserted: 0,
      updated: 0,
      errors: 0,
      backupSaved: false
    };
  }

  /**
   * 初期化
   */
  async initialize() {
    try {
      // バックアップディレクトリの作成
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // Supabaseクライアントの初期化
      if (this.useDatabase && this.supabaseUrl && this.supabaseKey) {
        try {
          const { createClient } = require('@supabase/supabase-js');
          this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
          console.log('🗄️ Supabaseデータベース接続を初期化しました');
        } catch (error) {
          console.log('⚠️ Supabaseライブラリが見つかりません。ローカル保存のみ使用します');
          this.useDatabase = false;
        }
      } else {
        console.log('📁 ローカルファイル保存モードで動作します');
        this.useDatabase = false;
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ データベース初期化エラー:', error.message);
      return false;
    }
  }

  /**
   * キャンペーンデータの保存
   */
  async saveCampaigns(campaigns, metadata = {}) {
    console.log(`💾 ${campaigns.length}件のキャンペーンデータを保存中...`);
    
    const results = {
      database: null,
      backup: null,
      stats: { ...this.stats }
    };

    try {
      // 1. ローカルバックアップの保存（常に実行）
      const backupResult = await this.saveLocalBackup(campaigns, metadata);
      results.backup = backupResult;
      this.stats.backupSaved = backupResult.success;

      // 2. データベースへの保存（設定されている場合）
      if (this.useDatabase && this.supabase) {
        const dbResult = await this.saveToDatatabase(campaigns, metadata);
        results.database = dbResult;
      }

      console.log(`✅ データ保存完了 (DB: ${results.database ? '○' : '×'}, Backup: ${results.backup.success ? '○' : '×'})`);
      
      return results;

    } catch (error) {
      console.error('❌ データ保存エラー:', error.message);
      this.stats.errors++;
      return { ...results, error: error.message };
    }
  }

  /**
   * データベースへの保存
   */
  async saveToDatatabase(campaigns, metadata) {
    try {
      console.log('🗄️ Supabaseデータベースに保存中...');

      // バッチ処理用にデータを準備
      const batchSize = 100;
      const batches = [];
      
      for (let i = 0; i < campaigns.length; i += batchSize) {
        batches.push(campaigns.slice(i, i + batchSize));
      }

      let insertCount = 0;
      let updateCount = 0;

      for (const batch of batches) {
        const preparedData = batch.map(campaign => ({
          campaign_id: campaign.id,
          title: campaign.title || '',
          points: campaign.points || '',
          condition: campaign.condition || '',
          description: campaign.description || '',
          category: campaign.category || '',
          category_name: campaign.categoryName || '',
          device: campaign.device || 'pc',
          url: campaign.url || '',
          scraped_at: campaign.scrapedAt || new Date().toISOString(),
          hash: campaign.hash || '',
          change_type: campaign.changeType || 'new',
          last_updated: new Date().toISOString()
        }));

        // upsert操作（存在すれば更新、なければ挿入）
        const { data, error } = await this.supabase
          .from(this.tableName)
          .upsert(preparedData, {
            onConflict: 'campaign_id',
            returning: 'minimal'
          });

        if (error) {
          console.error('データベース保存エラー:', error);
          this.stats.errors++;
          continue;
        }

        // 統計更新（正確な数は取得困難なため概算）
        const newItems = batch.filter(c => c.changeType === 'new').length;
        insertCount += newItems;
        updateCount += batch.length - newItems;
      }

      this.stats.inserted += insertCount;
      this.stats.updated += updateCount;

      console.log(`✅ データベース保存完了 (新規: ${insertCount}件, 更新: ${updateCount}件)`);

      return {
        success: true,
        inserted: insertCount,
        updated: updateCount,
        total: campaigns.length
      };

    } catch (error) {
      console.error('❌ データベース保存エラー:', error.message);
      this.stats.errors++;
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * ローカルバックアップの保存
   */
  async saveLocalBackup(campaigns, metadata) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `chobirich_backup_${timestamp}.json`;
      const filepath = path.join(this.backupDir, filename);

      const backupData = {
        timestamp: new Date().toISOString(),
        metadata: {
          total_campaigns: campaigns.length,
          scrape_mode: metadata.mode || 'unknown',
          ...metadata
        },
        campaigns: campaigns,
        stats: this.stats
      };

      await fs.writeFile(filepath, JSON.stringify(backupData, null, 2));

      console.log(`💾 ローカルバックアップ保存: ${filename}`);

      return {
        success: true,
        filename: filename,
        filepath: filepath,
        size: campaigns.length
      };

    } catch (error) {
      console.error('❌ ローカルバックアップエラー:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * データベーステーブルの作成（初回セットアップ用）
   */
  async createTableIfNotExists() {
    if (!this.useDatabase || !this.supabase) {
      console.log('⚠️ データベース接続が無効です');
      return false;
    }

    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id SERIAL PRIMARY KEY,
          campaign_id TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          points TEXT,
          condition TEXT,
          description TEXT,
          category TEXT,
          category_name TEXT,
          device TEXT DEFAULT 'pc',
          url TEXT,
          scraped_at TIMESTAMPTZ,
          hash TEXT,
          change_type TEXT DEFAULT 'new',
          last_updated TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_campaign_id ON ${this.tableName}(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_category ON ${this.tableName}(category);
        CREATE INDEX IF NOT EXISTS idx_scraped_at ON ${this.tableName}(scraped_at);
        CREATE INDEX IF NOT EXISTS idx_last_updated ON ${this.tableName}(last_updated);
      `;

      const { data, error } = await this.supabase.rpc('exec_sql', {
        sql: createTableSQL
      });

      if (error) {
        console.log('⚠️ テーブル作成スキップ（既存またはSQL実行権限なし）');
        return false;
      }

      console.log('✅ データベーステーブルを確認/作成しました');
      return true;

    } catch (error) {
      console.log('⚠️ テーブル作成をスキップしました:', error.message);
      return false;
    }
  }

  /**
   * 統計情報の取得
   */
  getStats() {
    return {
      ...this.stats,
      databaseEnabled: this.useDatabase,
      supabaseConnected: !!this.supabase
    };
  }

  /**
   * 統計情報のリセット
   */
  resetStats() {
    this.stats = {
      inserted: 0,
      updated: 0,
      errors: 0,
      backupSaved: false
    };
  }

  /**
   * 最新のバックアップファイルを取得
   */
  async getLatestBackup() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(f => f.startsWith('chobirich_backup_') && f.endsWith('.json'))
        .sort()
        .reverse();

      if (backupFiles.length === 0) {
        return null;
      }

      const latestFile = backupFiles[0];
      const filepath = path.join(this.backupDir, latestFile);
      const content = await fs.readFile(filepath, 'utf8');
      const data = JSON.parse(content);

      return {
        filename: latestFile,
        filepath: filepath,
        timestamp: data.timestamp,
        campaignCount: data.campaigns?.length || 0,
        data: data
      };

    } catch (error) {
      console.error('バックアップファイル取得エラー:', error.message);
      return null;
    }
  }

  /**
   * 古いバックアップファイルのクリーンアップ
   */
  async cleanupOldBackups(keepDays = 30) {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(f => f.startsWith('chobirich_backup_') && f.endsWith('.json'));
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);

      let deletedCount = 0;

      for (const file of backupFiles) {
        const filepath = path.join(this.backupDir, file);
        const stat = await fs.stat(filepath);
        
        if (stat.mtime < cutoffDate) {
          await fs.unlink(filepath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`🧹 古いバックアップを削除: ${deletedCount}ファイル`);
      }

      return deletedCount;

    } catch (error) {
      console.error('バックアップクリーンアップエラー:', error.message);
      return 0;
    }
  }
}

module.exports = DatabaseManager;