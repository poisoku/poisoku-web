# ポイ速 デプロイメント情報

## 現在の環境
- **URL**: https://poisoku.jp
- **ホスティング**: Vercel
- **ビルド方式**: Static Export (Next.js)
- **データ**: モックデータ（静的）

## 環境変数（Vercelに設定済み）
```
NEXT_PUBLIC_SUPABASE_URL=https://pjjhyzbnnslaauwzknrr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
RANKING_UPDATE_SECRET=poisoku-ranking-secret-2024
CRON_SECRET=poisoku-cron-secret-2024
SCRAPING_SECRET=poisoku-scraping-secret-2024
```

## バックアップ情報
- **GitHubリポジトリ**: https://github.com/poisoku/poisoku-web
- **静的デモ版タグ**: v1.0-static-demo
- **バックアップブランチ**: static-demo-backup
- **作成日**: 2025年1月27日

## 復元コマンド
```bash
# リポジトリをクローン
git clone https://github.com/poisoku/poisoku-web.git

# 静的デモ版に戻す
git checkout v1.0-static-demo

# ビルドして起動
npm install
npm run build
npm start
```

## ドメイン設定
- **Aレコード**: poisoku.jp → 216.198.79.193
- **CNAMEレコード**: www.poisoku.jp → cname.vercel-dns.com

## 今後の予定
1. ポイントサイトからAPI/CSVフィード提供
2. フィード連携機能の実装
3. 必要に応じてVPS移行