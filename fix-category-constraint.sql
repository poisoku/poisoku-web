-- 既存のcategory制約を削除して新しい制約を追加

-- 1. 既存の制約を削除
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_category_check;

-- 2. より柔軟な制約を追加（必要なカテゴリを許可）
ALTER TABLE campaigns ADD CONSTRAINT campaigns_category_check 
CHECK (category IN ('app', 'shopping', 'finance', 'service', 'entertainment', 'survey', 'other'));

-- 3. 確認クエリ - 現在のカテゴリの分布を確認
SELECT category, COUNT(*) as count 
FROM campaigns 
WHERE category IS NOT NULL
GROUP BY category 
ORDER BY count DESC;

-- 4. 制約情報を確認
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'campaigns'::regclass 
AND contype = 'c';