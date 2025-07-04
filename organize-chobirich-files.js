const fs = require('fs');
const path = require('path');

class ChobirichFileOrganizer {
  constructor() {
    this.baseDir = '/Users/kn/poisoku-web';
    this.chobirichDir = path.join(this.baseDir, 'chobirich');
    this.subDirs = {
      data: path.join(this.chobirichDir, 'data'),
      scripts: path.join(this.chobirichDir, 'scripts'),
      analysis: path.join(this.chobirichDir, 'analysis'),
      archive: path.join(this.chobirichDir, 'archive')
    };
  }

  // ディレクトリ作成
  createDirectories() {
    console.log('📁 ディレクトリ作成中...\n');
    
    // メインディレクトリ作成
    if (!fs.existsSync(this.chobirichDir)) {
      fs.mkdirSync(this.chobirichDir);
      console.log(`✅ 作成: ${this.chobirichDir}`);
    }
    
    // サブディレクトリ作成
    Object.entries(this.subDirs).forEach(([name, dir]) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
        console.log(`✅ 作成: ${name}/ (${dir})`);
      }
    });
    
    console.log('');
  }

  // ファイル分類とコピー
  organizeFiles() {
    console.log('📋 ファイル整理中...\n');
    
    // ファイル分類
    const fileCategories = {
      // 最終データファイル（重要）
      finalData: [
        { file: 'chobirich_android_ios_apps_data.json', dest: 'data', desc: '572件のAndroid/iOSアプリ案件データ' },
        { file: 'chobirich_all_categories_data.json', dest: 'data', desc: '1,224件の全カテゴリー案件データ' },
        { file: 'chobirich_all_ids.json', dest: 'data', desc: '572件のアプリ案件IDリスト' }
      ],
      
      // アクティブスクリプト
      activeScripts: [
        { file: 'scripts/chobirich-error-resistant.js', dest: 'scripts', desc: 'エラー耐性スクレイパー（推奨）' },
        { file: 'scripts/chobirich-quality-improved.js', dest: 'scripts', desc: 'データ品質改善スクレイパー' },
        { file: 'scripts/analyze-data-quality.js', dest: 'analysis', desc: 'データ品質分析ツール' }
      ],
      
      // 古いデータファイル（アーカイブ）
      oldData: [
        { file: 'chobirich_full_data.json', dest: 'archive', desc: '旧データ' },
        { file: 'chobirich_corrected_data.json', dest: 'archive', desc: '旧データ' },
        { file: 'chobirich_fixed_data.json', dest: 'archive', desc: '旧データ' },
        { file: 'chobirich_final_data.json', dest: 'archive', desc: '旧データ' },
        { file: 'chobirich_fixed_final_data.json', dest: 'archive', desc: '旧データ' },
        { file: 'chobirich_mobile_apps_data.json', dest: 'archive', desc: '旧データ' },
        { file: 'chobirich_mobile_apps_improved_data.json', dest: 'archive', desc: '旧データ' },
        { file: 'chobirich_mobile_apps_final_data.json', dest: 'archive', desc: '旧データ' },
        { file: 'chobirich_complete_apps_data.json', dest: 'archive', desc: '旧データ' }
      ],
      
      // 古いスクリプト（アーカイブ）
      oldScripts: [
        { file: 'scripts/analyze-chobirich.js', dest: 'archive', desc: '旧スクリプト' },
        { file: 'scripts/chobirich-simple-test.js', dest: 'archive', desc: '旧スクリプト' },
        { file: 'scripts/scrape-chobirich.js', dest: 'archive', desc: '旧スクリプト' },
        { file: 'scripts/chobirich-puppeteer.js', dest: 'archive', desc: '旧スクリプト' },
        { file: 'scripts/chobirich-network-monitor.js', dest: 'archive', desc: '旧スクリプト' },
        { file: 'scripts/chobirich-full-scraper.js', dest: 'archive', desc: '旧スクリプト' },
        { file: 'scripts/chobirich-corrected-scraper.js', dest: 'archive', desc: '旧スクリプト' },
        { file: 'scripts/debug-chobirich.js', dest: 'archive', desc: '旧スクリプト' },
        { file: 'scripts/chobirich-fixed-scraper.js', dest: 'archive', desc: '旧スクリプト' },
        { file: 'scripts/chobirich-final-scraper.js', dest: 'archive', desc: '旧スクリプト' },
        { file: 'scripts/chobirich-ultimate-scraper.js', dest: 'archive', desc: '旧スクリプト' },
        { file: 'scripts/chobirich-fixed-final.js', dest: 'archive', desc: '旧スクリプト' },
        { file: 'scripts/chobirich-all-categories.js', dest: 'archive', desc: '旧スクリプト' },
        { file: 'scripts/chobirich-mobile-apps.js', dest: 'archive', desc: '旧スクリプト' },
        { file: 'scripts/chobirich-mobile-apps-improved.js', dest: 'archive', desc: '旧スクリプト' },
        { file: 'scripts/chobirich-mobile-apps-final.js', dest: 'archive', desc: '旧スクリプト' },
        { file: 'scripts/chobirich-android-ios-apps.js', dest: 'archive', desc: '旧スクリプト' },
        { file: 'scripts/chobirich-android-ios-batch.js', dest: 'archive', desc: '旧スクリプト' }
      ],
      
      // その他ファイル
      others: [
        { file: 'run-chobirich-scraper.js', dest: 'archive', desc: '旧実行ファイル' },
        { file: 'chobirich-test.png', dest: 'analysis', desc: 'テスト画像' },
        { file: 'debug-chobirich.png', dest: 'analysis', desc: 'デバッグ画像' },
        { file: 'analyze_chobirich.py', dest: 'archive', desc: '旧分析スクリプト' },
        { file: 'analyze_chobirich.js', dest: 'archive', desc: '旧分析スクリプト' },
        { file: 'cleanup-chobirich-files.js', dest: 'analysis', desc: 'ファイル整理スクリプト' }
      ]
    };

    // 各カテゴリーのファイルを処理
    let movedCount = 0;
    let totalCount = 0;

    Object.entries(fileCategories).forEach(([categoryName, files]) => {
      console.log(`=== ${categoryName} ===`);
      
      files.forEach(({ file, dest, desc }) => {
        const sourcePath = path.join(this.baseDir, file);
        const fileName = path.basename(file);
        const destPath = path.join(this.subDirs[dest], fileName);
        
        totalCount++;
        
        if (fs.existsSync(sourcePath)) {
          try {
            // ファイルコピー
            fs.copyFileSync(sourcePath, destPath);
            
            // 元ファイル削除
            fs.unlinkSync(sourcePath);
            
            console.log(`✅ ${file} → ${dest}/ (${desc})`);
            movedCount++;
          } catch (error) {
            console.log(`❌ エラー: ${file} - ${error.message}`);
          }
        } else {
          console.log(`⚠️ 見つからない: ${file}`);
        }
      });
      
      console.log('');
    });

    console.log(`\n📊 移動完了: ${movedCount}/${totalCount}件`);
  }

  // READMEファイル作成
  createReadme() {
    const readmeContent = `# ちょびリッチ スクレイピングプロジェクト

## 📁 ディレクトリ構成

### data/
最終的な取得データファイル
- \`chobirich_android_ios_apps_data.json\` - **572件のAndroid/iOSアプリ案件データ**
- \`chobirich_all_categories_data.json\` - **1,224件の全カテゴリー案件データ**  
- \`chobirich_all_ids.json\` - 572件のアプリ案件IDリスト

### scripts/
アクティブなスクリプトファイル
- \`chobirich-error-resistant.js\` - **エラー耐性スクレイパー（推奨）**
- \`chobirich-quality-improved.js\` - データ品質改善スクレイパー

### analysis/
分析ツールと結果ファイル
- \`analyze-data-quality.js\` - データ品質分析ツール
- \`cleanup-chobirich-files.js\` - ファイル整理スクリプト
- \`chobirich-test.png\` - テスト画像
- \`debug-chobirich.png\` - デバッグ画像

### archive/
過去のバージョンや試行版ファイル
- 開発過程で作成された古いスクリプトとデータファイル

## 🎯 プロジェクト成果

### 主要成果
1. **AndroidとiOS両対応**: 572件のアプリ案件データ取得
2. **全カテゴリー対応**: 1,224件の包括的データ取得
3. **エラー耐性**: 99.8%の成功率を達成

### 技術的発見
- AndroidとiOSで異なる案件が表示される
- User-Agent切り替えにより追加の案件を発見
- 403エラー対策とConnection Closedエラー解決

## 🚀 使用方法

### データ品質改善
\`\`\`bash
cd scripts
node analyze-data-quality.js  # 現状分析
node chobirich-quality-improved.js  # 品質改善実行
\`\`\`

### 新規スクレイピング
\`\`\`bash
cd scripts
node chobirich-error-resistant.js  # 安定スクレイパー実行
\`\`\`

## 📊 データ統計

### アプリ案件 (572件)
- iOS専用: 82件
- Android専用: 78件
- OS不明: 412件
- ポイント還元: 287件 (50.2%)

### 全カテゴリー (1,224件)
- ショッピング、サービス、旅行、アプリなど
- ％還元とポイント還元の混在
- 複数ページにわたる完全取得

---
作成日: ${new Date().toISOString().split('T')[0]}
最終更新: ${new Date().toISOString()}
`;

    const readmePath = path.join(this.chobirichDir, 'README.md');
    fs.writeFileSync(readmePath, readmeContent);
    console.log(`📄 README.md作成: ${readmePath}`);
  }

  // メイン実行
  organize() {
    console.log('🗂️ ちょびリッチファイル整理開始\n');
    
    this.createDirectories();
    this.organizeFiles();
    this.createReadme();
    
    console.log('\n✨ 整理完了！');
    console.log(`📁 すべてのファイルは ${this.chobirichDir} に整理されました\n`);
    
    // 結果表示
    this.showFinalStructure();
  }

  // 最終的なフォルダ構成を表示
  showFinalStructure() {
    console.log('📁 最終的なフォルダ構成:');
    console.log('chobirich/');
    console.log('├── README.md');
    console.log('├── data/');
    console.log('│   ├── chobirich_android_ios_apps_data.json (重要)');
    console.log('│   ├── chobirich_all_categories_data.json (重要)');
    console.log('│   └── chobirich_all_ids.json');
    console.log('├── scripts/');
    console.log('│   ├── chobirich-error-resistant.js (推奨)');
    console.log('│   └── chobirich-quality-improved.js');
    console.log('├── analysis/');
    console.log('│   ├── analyze-data-quality.js');
    console.log('│   ├── cleanup-chobirich-files.js');
    console.log('│   ├── chobirich-test.png');
    console.log('│   └── debug-chobirich.png');
    console.log('└── archive/');
    console.log('    └── (過去バージョンファイル)');
  }
}

// 実行
const organizer = new ChobirichFileOrganizer();
organizer.organize();