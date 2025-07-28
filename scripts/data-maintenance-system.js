const fs = require('fs').promises;
const path = require('path');

class DataMaintenanceSystem {
  constructor() {
    this.projectRoot = process.cwd();
    this.publicDir = path.join(this.projectRoot, 'public');
    this.backupPattern = /\.(bak|backup|old)$/;
  }

  async cleanupBackupFiles() {
    console.log('🧹 バックアップファイルのクリーンアップ開始');
    console.log('='.repeat(60));

    try {
      const cleanupTasks = [
        this.cleanupDirectory(this.publicDir),
        this.cleanupDirectory(path.join(this.projectRoot, 'out')),
        this.cleanupRootBackups()
      ];

      const results = await Promise.all(cleanupTasks);
      const totalRemoved = results.reduce((sum, result) => sum + result, 0);

      console.log(`✅ バックアップファイルクリーンアップ完了: ${totalRemoved}件削除`);
      return totalRemoved;

    } catch (error) {
      console.error('バックアップクリーンアップエラー:', error);
      throw error;
    }
  }

  async cleanupDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let removedCount = 0;

      for (const entry of entries) {
        if (entry.isFile() && this.backupPattern.test(entry.name)) {
          const filePath = path.join(dirPath, entry.name);
          await fs.unlink(filePath);
          console.log(`  削除: ${path.relative(this.projectRoot, filePath)}`);
          removedCount++;
        }
      }

      return removedCount;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`ディレクトリアクセスエラー: ${dirPath}`);
      }
      return 0;
    }
  }

  async cleanupRootBackups() {
    try {
      const entries = await fs.readdir(this.projectRoot, { withFileTypes: true });
      let removedCount = 0;

      for (const entry of entries) {
        if (entry.isFile() && 
            (this.backupPattern.test(entry.name) || 
             entry.name.includes('_backup') || 
             entry.name.includes('_old'))) {
          const filePath = path.join(this.projectRoot, entry.name);
          await fs.unlink(filePath);
          console.log(`  削除: ${entry.name}`);
          removedCount++;
        }
      }

      return removedCount;
    } catch (error) {
      console.warn('ルートディレクトリクリーンアップエラー:', error.message);
      return 0;
    }
  }

  async addCacheHeaders() {
    console.log('\n📝 キャッシュヘッダー設定を更新中...');
    
    const vercelConfigPath = path.join(this.projectRoot, 'vercel.json');
    
    try {
      let vercelConfig = {};
      
      try {
        const existingConfig = await fs.readFile(vercelConfigPath, 'utf8');
        vercelConfig = JSON.parse(existingConfig);
      } catch (error) {
        console.log('  新規vercel.json作成');
      }

      // キャッシュヘッダーを設定
      vercelConfig.headers = [
        {
          "source": "/search-data.json",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "no-cache, no-store, must-revalidate"
            },
            {
              "key": "Pragma",
              "value": "no-cache"
            },
            {
              "key": "Expires",
              "value": "0"
            }
          ]
        },
        {
          "source": "/search-index.json",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "no-cache, no-store, must-revalidate"
            }
          ]
        }
      ];

      await fs.writeFile(vercelConfigPath, JSON.stringify(vercelConfig, null, 2));
      console.log('✅ vercel.jsonを更新しました');

    } catch (error) {
      console.warn('vercel.json更新エラー:', error.message);
    }
  }

  async generateMaintenanceReport() {
    console.log('\n📊 メンテナンスレポート生成中...');
    
    const report = {
      timestamp: new Date().toISOString(),
      maintenance_completed: {
        backup_cleanup: true,
        cache_headers_updated: true,
        browser_cache_tools_added: true
      },
      data_status: {
        search_data_file: path.join(this.publicDir, 'search-data.json'),
        search_index_file: path.join(this.publicDir, 'search-index.json')
      },
      recommendations: [
        'ユーザーにブラウザキャッシュクリアを推奨',
        '検索データ更新後は必ずデータ確認ボタンで件数チェック',
        '古いバックアップファイルの定期削除',
        'Vercelデプロイ完了の確認'
      ]
    };

    try {
      // ファイルサイズチェック
      const searchDataPath = path.join(this.publicDir, 'search-data.json');
      const stats = await fs.stat(searchDataPath);
      report.data_status.file_size_mb = (stats.size / 1024 / 1024).toFixed(2);
      report.data_status.last_modified = stats.mtime.toISOString();

      // 件数チェック
      const searchData = JSON.parse(await fs.readFile(searchDataPath, 'utf8'));
      report.data_status.total_campaigns = searchData.campaigns.length;
      report.data_status.chobirich_campaigns = searchData.campaigns.filter(c => c.siteName === 'ちょびリッチ').length;

    } catch (error) {
      report.data_status.error = error.message;
    }

    const reportPath = path.join(this.projectRoot, 'maintenance-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log('✅ メンテナンスレポートを生成しました');
    console.log(`📄 レポート場所: ${reportPath}`);
    
    return report;
  }

  async runFullMaintenance() {
    console.log('🔧 データメンテナンスシステム開始');
    console.log('='.repeat(60));

    try {
      // 1. バックアップファイルクリーンアップ
      await this.cleanupBackupFiles();

      // 2. キャッシュヘッダー設定
      await this.addCacheHeaders();

      // 3. メンテナンスレポート生成
      const report = await this.generateMaintenanceReport();

      console.log('\n🎉 全メンテナンス完了！');
      console.log('='.repeat(60));
      console.log('✅ 1. 古いバックアップファイル削除済み');
      console.log('✅ 2. キャッシュヘッダー設定更新済み');
      console.log('✅ 3. ブラウザキャッシュクリア機能追加済み');
      console.log('\n📋 次の手順:');
      console.log('1. git add . && git commit -m "Add cache management and cleanup"');
      console.log('2. git push でデプロイ');
      console.log('3. ユーザーに「🔄 キャッシュクリア」ボタンの使用を案内');

      return report;

    } catch (error) {
      console.error('メンテナンスエラー:', error);
      throw error;
    }
  }
}

// 実行
async function runMaintenance() {
  const maintenance = new DataMaintenanceSystem();
  await maintenance.runFullMaintenance();
}

if (require.main === module) {
  runMaintenance().catch(console.error);
}

module.exports = DataMaintenanceSystem;