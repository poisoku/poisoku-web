-- 追加のクリーンアップ

-- 1. 残っているプロモーションテキストを除去
UPDATE campaigns 
SET name = TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(name, '残り\d+日', '', 'g'),      -- 残り〇日を除去
        '※[^※]*※', '', 'g'                            -- ※〜※を除去
      ),
      '（リピート利用OK）.*$', '', 'g'                   -- リピート利用OKとその後を除去
    ),
    '\s+', ' ', 'g'                                    -- 空白を正規化
  )
)
WHERE name ~ '残り\d+日|※.*※|（リピート利用OK）';

-- 2. 名前末尾の不完全なテキストを除去（例：「2.」で終わるもの）
UPDATE campaigns
SET name = TRIM(REGEXP_REPLACE(name, '\s+\d+\.$', '', 'g'))
WHERE name ~ '\s+\d+\.$';

-- 3. 楽天Koboの重複を確認
SELECT name, COUNT(*) as count, STRING_AGG(id::text, ', ') as ids
FROM campaigns 
WHERE name ILIKE '%楽天Kobo%'
GROUP BY name
HAVING COUNT(*) > 1;

-- 4. 完全な重複を再度削除
WITH duplicate_campaigns AS (
  SELECT 
    name, 
    point_site_id, 
    device,
    cashback_rate,
    MIN(id) as keep_id,
    ARRAY_AGG(id ORDER BY created_at DESC) as all_ids
  FROM campaigns 
  GROUP BY name, point_site_id, device, cashback_rate
  HAVING COUNT(*) > 1
),
ids_to_delete AS (
  SELECT 
    UNNEST(all_ids[2:]) as delete_id
  FROM duplicate_campaigns
)
DELETE FROM campaigns 
WHERE id IN (SELECT delete_id FROM ids_to_delete);

-- 5. クリーンアップ後の確認
SELECT name, cashback_rate, point_site_id
FROM campaigns 
WHERE name ILIKE '%楽天%'
ORDER BY name
LIMIT 20;