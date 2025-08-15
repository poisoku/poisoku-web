#!/usr/bin/env node

/**
 * ちょびリッチ順次スクレイピングシステム
 * 403エラー対策として拡張システム・iOS・Androidを2分間隔で順次実行
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class SequentialScrapingSystem {
  constructor() {
    this.results = {
      extended: { success: false, campaigns: 0, error: null },
      ios: { success: false, campaigns: 0, error: null },
      android: { success: false, campaigns: 0, error: null }
    };
    this.startTime = new Date();
  }

  async execute() {
    console.log('🚀 ちょびリッチ順次スクレイピングシステム');
    console.log('='.repeat(70));
    console.log('🛡️ 403エラー対策: 各システム間2分待機');
    console.log('📋 実行順序:');
    console.log('  1. 拡張システム（全20カテゴリ）');
    console.log('  2. 2分待機');
    console.log('  3. iOS案件スクレイピング');
    console.log('  4. 2分待機');
    console.log('  5. Android案件スクレイピング');
    console.log('='.repeat(70));

    try {
      // 1. 拡張システム実行
      console.log('\\n📂 Step 1: 拡張システム実行開始');
      await this.runExtendedSystem();
      
      // 2分待機
      console.log('\\n⏳ Step 2: 2分待機（403エラー対策）...');
      await this.wait(120000);
      
      // 2. iOS案件実行
      console.log('\\n📱 Step 3: iOS案件スクレイピング開始');
      await this.runIOSSystem();
      
      // 2分待機
      console.log('\\n⏳ Step 4: 2分待機（403エラー対策）...');
      await this.wait(120000);
      
      // 3. Android案件実行
      console.log('\\n🤖 Step 5: Android案件スクレイピング開始');
      await this.runAndroidSystem();
      
      // 最終レポート
      await this.generateFinalReport();
      
    } catch (error) {
      console.error('💥 システムエラー:', error);
    }
  }

  async runExtendedSystem() {
    return new Promise((resolve, reject) => {
      const process = spawn('node', ['main_extended.js', 'all'], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let output = '';
      process.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log(text.replace(/\\n$/, ''));
      });

      process.stderr.on('data', (data) => {
        console.error(data.toString());
      });

      process.on('close', (code) => {
        if (code === 0) {
          console.log('✅ 拡張システム完了');
          this.results.extended.success = true;
          this.extractExtendedResults(output);
        } else {
          console.log(`❌ 拡張システム失敗 (exit code: ${code})`);
          this.results.extended.error = `Exit code: ${code}`;
        }
        resolve();
      });

      // タイムアウト設定（20分）
      setTimeout(() => {
        process.kill('SIGTERM');
        console.log('⚠️ 拡張システムタイムアウト（20分）');
        this.results.extended.error = 'Timeout after 20 minutes';
        resolve();
      }, 1200000);
    });
  }

  async runIOSSystem() {
    return new Promise((resolve, reject) => {
      const process = spawn('node', ['main_mobile_app.js', 'ios'], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let output = '';
      process.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log(text.replace(/\\n$/, ''));
      });

      process.stderr.on('data', (data) => {
        console.error(data.toString());
      });

      process.on('close', (code) => {
        if (code === 0) {
          console.log('✅ iOS案件スクレイピング完了');
          this.results.ios.success = true;
          this.extractIOSResults(output);
        } else {
          console.log(`❌ iOS案件スクレイピング失敗 (exit code: ${code})`);
          this.results.ios.error = `Exit code: ${code}`;
        }
        resolve();
      });

      // タイムアウト設定（10分）
      setTimeout(() => {
        process.kill('SIGTERM');
        console.log('⚠️ iOS案件スクレイピングタイムアウト（10分）');
        this.results.ios.error = 'Timeout after 10 minutes';
        resolve();
      }, 600000);
    });
  }

  async runAndroidSystem() {
    return new Promise((resolve, reject) => {
      const process = spawn('node', ['main_mobile_app.js', 'android'], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let output = '';
      process.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log(text.replace(/\\n$/, ''));
      });

      process.stderr.on('data', (data) => {
        console.error(data.toString());
      });

      process.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Android案件スクレイピング完了');
          this.results.android.success = true;
          this.extractAndroidResults(output);
        } else {
          console.log(`❌ Android案件スクレイピング失敗 (exit code: ${code})`);
          this.results.android.error = `Exit code: ${code}`;
        }
        resolve();
      });

      // タイムアウト設定（10分）
      setTimeout(() => {
        process.kill('SIGTERM');
        console.log('⚠️ Android案件スクレイピングタイムアウト（10分）');
        this.results.android.error = 'Timeout after 10 minutes';
        resolve();
      }, 600000);
    });
  }

  extractExtendedResults(output) {
    const campaignMatch = output.match(/取得案件数: (\\d+)/);
    if (campaignMatch) {
      this.results.extended.campaigns = parseInt(campaignMatch[1]);
    }
  }

  extractIOSResults(output) {
    const campaignMatch = output.match(/iOS: (\\d+)件/);
    if (campaignMatch) {
      this.results.ios.campaigns = parseInt(campaignMatch[1]);
    }
  }

  extractAndroidResults(output) {
    const campaignMatch = output.match(/Android: (\\d+)件/);
    if (campaignMatch) {
      this.results.android.campaigns = parseInt(campaignMatch[1]);
    }
  }

  async generateFinalReport() {
    const endTime = new Date();
    const duration = (endTime - this.startTime) / 1000;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);

    console.log('\\n' + '='.repeat(70));
    console.log('📊 順次スクレイピング完了レポート');
    console.log('='.repeat(70));
    console.log(`⏱️ 総実行時間: ${minutes}分${seconds}秒`);
    console.log();

    // 拡張システム結果
    console.log('🛍️ 拡張システム（ショッピング・サービス）:');
    if (this.results.extended.success) {
      console.log(`   ✅ 成功: ${this.results.extended.campaigns}件取得`);
    } else {
      console.log(`   ❌ 失敗: ${this.results.extended.error || '不明なエラー'}`);
    }

    // iOS結果
    console.log('📱 iOS案件:');
    if (this.results.ios.success) {
      console.log(`   ✅ 成功: ${this.results.ios.campaigns}件取得`);
    } else {
      console.log(`   ❌ 失敗: ${this.results.ios.error || '不明なエラー'}`);
    }

    // Android結果
    console.log('🤖 Android案件:');
    if (this.results.android.success) {
      console.log(`   ✅ 成功: ${this.results.android.campaigns}件取得`);
    } else {
      console.log(`   ❌ 失敗: ${this.results.android.error || '不明なエラー'}`);
    }

    // 合計
    const totalCampaigns = this.results.extended.campaigns + 
                          this.results.ios.campaigns + 
                          this.results.android.campaigns;
    console.log(`\\n🎯 総取得案件数: ${totalCampaigns}件`);

    // 成功率
    const successCount = [this.results.extended.success, this.results.ios.success, this.results.android.success]
      .filter(Boolean).length;
    const successRate = (successCount / 3 * 100).toFixed(1);
    console.log(`📊 システム成功率: ${successRate}% (${successCount}/3)`);

    if (successRate === '100.0') {
      console.log('\\n🎉 全システムで403エラーを回避して完全成功！');
    } else if (parseFloat(successRate) >= 66.7) {
      console.log('\\n🎊 大部分のシステムで成功！403エラー対策が効果的です。');
    }

    console.log('\\n✅ 順次スクレイピングシステム実行完了');
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 実行
if (require.main === module) {
  const system = new SequentialScrapingSystem();
  system.execute().catch(console.error);
}

module.exports = SequentialScrapingSystem;