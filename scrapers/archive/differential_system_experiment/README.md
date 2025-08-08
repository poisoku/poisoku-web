# 差分取得システム実験アーカイブ

**作成日**: 2025-08-07  
**ステータス**: 実験終了・アーカイブ済み  
**結論**: 技術的限界により廃止

## 実験概要

ちょびリッチの案件データを差分取得により効率化する実験を実施。
処理時間の短縮（45分 → 1-5分）を目指したが、取得漏れが83.6%発生し断念。

## 実験結果

### 作成したシステム
1. **軽量差分取得システム** (`chobirich_differential_system.js`)
   - 処理時間: 1分
   - 取得率: 16.4%
   - 結果: 取得漏れ83.6% で使用不可

2. **完全差分取得システム** (`chobirich_complete_differential_system.js`)
   - エラーで実行不可

3. **ハイブリッド差分システム** (`chobirich_hybrid_differential_system.js`)  
   - 処理時間: 45分（v3と同じ）
   - 取得率: 100%
   - 結果: 時間短縮効果なしで不採用

### 技術的制約
- **Web案件**: 20カテゴリ × 15ページ = 300ページの完全スキャン必須
- **モバイル案件**: iOS/Android専用UAでの全ページアクセス必須
- **動的配置**: 新規案件が深いページに配置される

## 最終判定

**差分取得システムは技術的限界により実用不可**

### 採用されたシステム
- **方針A: 完全取得のみ** (`daily_complete_update.js`)
- 処理時間: 45分
- 取得率: 100%  
- シンプル・確実・メンテナンス性良好

## アーカイブファイル一覧

### システムファイル
- `chobirich_differential_system.js` - 軽量差分取得システム
- `run_differential.js` - 統合実行スクリプト
- `analyze_differential_issues.js` - 問題分析ツール
- `chobirich_complete_differential_system.js` - 完全差分取得システム（未完成）
- `chobirich_hybrid_differential_system.js` - ハイブリッド差分システム
- `create_baseline.js` - ベースライン生成
- `debug_lightweight_scraper.js` - デバッグ用
- `LightweightScraper.js` - 軽量スクレイピング用ヘルパー

### データファイル
- `chobirich_baseline.json` - ベースラインデータ（3,644件）
- `chobirich_delta.json` - 軽量差分結果
- `chobirich_complete_delta.json` - 完全差分結果（空）
- `differential_2025-08-04T08-42-04-029Z.json` - 初期実験データ

## 教訓

1. **技術的制約の正確な把握が重要**
2. **シンプルなシステムの価値**
3. **確実性 > 効率性の場合もある**
4. **プロトタイピングによる早期検証の重要性**

---
*このアーカイブは将来の参考資料として保存されています。*