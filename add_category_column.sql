-- campaignsテーブルにcategoryカラムを追加
-- このSQLをSupabaseダッシュボードのSQL Editorで実行してください

-- 1. categoryカラムを追加（存在しない場合のみ）
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS category text DEFAULT 'other';

-- 2. 有効なカテゴリの制約を追加（オプション）
-- ALTER TABLE campaigns ADD CONSTRAINT check_campaign_category 
-- CHECK (category IN ('app', 'shopping', 'finance', 'service', 'entertainment', 'other'));

-- 3. カテゴリのインデックスを作成（検索性能向上のため）
CREATE INDEX IF NOT EXISTS idx_campaigns_category ON campaigns(category);

-- 4. カテゴリとデバイスの複合インデックス（フィルタリング性能向上のため）
CREATE INDEX IF NOT EXISTS idx_campaigns_category_device ON campaigns(category, device);

-- 5. 確認クエリ - カラムが追加されたか確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'campaigns'
ORDER BY ordinal_position;

-- 6. 統計確認
SELECT 
  category, 
  device,
  COUNT(*) as count 
FROM campaigns 
GROUP BY category, device 
ORDER BY category, device;