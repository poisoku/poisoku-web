// データベース統合と検索データ生成を実行するスクリプト

const { spawn } = require('child_process');
const path = require('path');

async function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 実行中: ${command} ${args.join(' ')}`);
    console.log(`📁 作業ディレクトリ: ${cwd}`);
    
    const child = spawn(command, args, { 
      cwd, 
      stdio: 'inherit',
      shell: true 
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ 完了: ${command} ${args.join(' ')}`);
        resolve();
      } else {
        console.error(`❌ エラー: ${command} ${args.join(' ')} (終了コード: ${code})`);
        reject(new Error(`Command failed with code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      console.error(`❌ 実行エラー: ${error.message}`);
      reject(error);
    });
  });
}

async function executeIntegration() {
  const projectRoot = '/Users/kn/poisoku-web';
  const pointincomeDir = path.join(projectRoot, 'scripts', 'pointincome');
  
  console.log('🎯 ポイントインカムデータ統合プロセス開始');
  console.log('=' .repeat(60));
  
  try {
    // ステップ1: データベース統合（categoryカラム対応版）
    console.log('\n📊 ステップ1: データベース統合（categoryカラム対応版）');
    console.log('-'.repeat(50));
    await runCommand('node', ['integrate-to-database.js'], pointincomeDir);
    
    // ステップ2: 検索データ再生成
    console.log('\n🔍 ステップ2: 検索データ再生成');
    console.log('-'.repeat(50));
    await runCommand('node', ['scripts/generate-search-data.js'], projectRoot);
    
    // ステップ3: 結果確認
    console.log('\n📋 ステップ3: 結果確認');
    console.log('-'.repeat(50));
    
    // 獅子の如くの確認
    console.log('🎯 獅子の如くの検索:');
    await runCommand('grep', ['-n', '獅子の如く', 'public/search-data.json'], projectRoot);
    
    // iOS/Android案件数の確認
    console.log('\n📱 デバイス別案件数:');
    await runCommand('grep', ['-c', '"device": "iOS"', 'public/search-data.json'], projectRoot);
    await runCommand('grep', ['-c', '"device": "Android"', 'public/search-data.json'], projectRoot);
    
    console.log('\n🎉 すべてのプロセスが完了しました！');
    console.log('\n次のステップ:');
    console.log('git add . && git commit -m "Complete mobile app integration with category support" && git push');
    
  } catch (error) {
    console.error('❌ プロセス中にエラーが発生しました:', error.message);
    process.exit(1);
  }
}

// 実行
executeIntegration();