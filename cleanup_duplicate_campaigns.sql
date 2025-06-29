-- 重複案件の削除とデータクリーンアップ

-- 1. 案件名から還元率を除去してクリーンアップ
UPDATE campaigns 
SET name = TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(name, '\s+', ' ', 'g'),  -- 複数空白を1つに
          '[\n\t]+', ' ', 'g'                     -- 改行・タブを空白に
        ),
        '【[^】]*】', '', 'g'                    -- 【】内テキストを除去
      ),
      '\s*-?\s*[\d,，]+[P円ポイント%％]\s*$', '', 'g'  -- 末尾の還元率を除去
    ),
    '\s+', ' ', 'g'                             -- 再度空白を正規化
  )
)
WHERE name ~ '[\d,，]+[P円ポイント%％]$|【.*】|\s{2,}|[\n\t]';

-- 2. 重複案件を特定（同じname, point_site_id, deviceの組み合わせ）
WITH duplicate_campaigns AS (
  SELECT 
    name, 
    point_site_id, 
    device,
    MIN(id) as keep_id,
    ARRAY_AGG(id ORDER BY created_at DESC) as all_ids
  FROM campaigns 
  GROUP BY name, point_site_id, device
  HAVING COUNT(*) > 1
),
ids_to_delete AS (
  SELECT 
    UNNEST(all_ids[2:]) as delete_id
  FROM duplicate_campaigns
)
-- 3. 重複案件を削除（最新のもの以外）
DELETE FROM campaigns 
WHERE id IN (SELECT delete_id FROM ids_to_delete);

-- 4. 統計情報を表示
SELECT 
  'Total campaigns after cleanup' as description,
  COUNT(*) as count
FROM campaigns
UNION ALL
SELECT 
  'Unique campaign names' as description,
  COUNT(DISTINCT name) as count
FROM campaigns
UNION ALL
SELECT 
  'Point sites covered' as description,
  COUNT(DISTINCT point_site_id) as count
FROM campaigns;