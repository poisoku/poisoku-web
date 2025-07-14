-- campaignsテーブルにcategoryカラムを追加
-- SupabaseダッシュボードのSQL Editorで実行してください

-- 1. categoryカラムを追加（存在しない場合のみ）
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS category text DEFAULT 'other';

-- 2. カテゴリのインデックスを作成（検索性能向上のため）
CREATE INDEX IF NOT EXISTS idx_campaigns_category ON campaigns(category);

-- 3. カテゴリとデバイスの複合インデックス（フィルタリング性能向上のため）
CREATE INDEX IF NOT EXISTS idx_campaigns_category_device ON campaigns(category, device);

-- 4. カテゴリの制約を追加（オプション）
-- ALTER TABLE campaigns ADD CONSTRAINT check_category 
-- CHECK (category IN ('app', 'shopping', 'finance', 'service', 'entertainment', 'other'));

-- 5. 既存データの更新（必要に応じて）
-- ショッピング系のデータを更新
UPDATE campaigns 
SET category = 'shopping' 
WHERE category = 'other' 
  AND (description ILIKE '%ショッピング%' 
       OR description ILIKE '%通販%' 
       OR description ILIKE '%クリーニング%');

-- モバイルアプリ系のデータを更新（デバイス情報から推測）
UPDATE campaigns 
SET category = 'app' 
WHERE category = 'other' 
  AND (device IN ('iOS', 'Android') 
       OR description ILIKE '%アプリ%' 
       OR description ILIKE '%ゲーム%');

-- 金融系のデータを更新  
UPDATE campaigns 
SET category = 'finance' 
WHERE category = 'other' 
  AND (description ILIKE '%クレジット%' 
       OR description ILIKE '%ローン%' 
       OR description ILIKE '%銀行%' 
       OR description ILIKE '%投資%' 
       OR description ILIKE '%口座%');

-- 確認クエリ
SELECT 
  category, 
  device,
  COUNT(*) as count 
FROM campaigns 
GROUP BY category, device 
ORDER BY category, device;