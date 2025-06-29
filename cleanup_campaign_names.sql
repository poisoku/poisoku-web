-- 案件名のクリーンアップ（還元率除去）

-- 1. 案件名から還元率やその他の不要な文字を除去
UPDATE campaigns 
SET name = TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  REGEXP_REPLACE(
                    REGEXP_REPLACE(
                      REGEXP_REPLACE(
                        REGEXP_REPLACE(name, '\s+', ' ', 'g'),  -- 複数空白を1つに
                        '[\n\t]+', ' ', 'g'                     -- 改行・タブを空白に
                      ),
                      '【[^】]*】', '', 'g'                    -- 【】内テキストを除去
                    ),
                    '\([^)]*\)', '', 'g'                      -- ()内テキストを除去
                  ),
                  '\s*[\d,，]+\.?\d*[P円ポイントpt%％]\s*', '', 'g'  -- 還元率を除去
                ),
                '\s*-\s*[\d,，]+\.?\d*[P円ポイントpt%％]\s*', '', 'g'  -- ハイフン付き還元率を除去
              ),
              '\s*:\s*[\d,，]+\.?\d*[P円ポイントpt%％]\s*', '', 'g'   -- コロン付き還元率を除去
            ),
            '\s*～\s*[\d,，]+\.?\d*[P円ポイントpt%％]\s*', '', 'g'    -- 波線付き還元率を除去
          ),
          '\s*最大\s*[\d,，]+\.?\d*[P円ポイントpt%％]\s*', '', 'g'   -- 最大〇〇Pを除去
        ),
        '\s*[Uu]p\s*[Tt]o\s*[\d,，]+\.?\d*[P円ポイントpt%％]\s*', '', 'g'  -- up to 〇〇Pを除去
      ),
      '\s*\d+\.?\d*\s*倍\s*', '', 'g'                        -- 〇倍を除去
    ),
    '\s+', ' ', 'g'                                         -- 再度空白を正規化
  )
)
WHERE name ~ '[\d,，]+\.?\d*[P円ポイントpt%％]|【.*】|\([^)]*\)|\s{2,}|[\n\t]|最大|倍|up\s*to';

-- 2. 空の名前や短すぎる名前を持つ案件を確認
SELECT COUNT(*) as empty_or_short_names
FROM campaigns 
WHERE LENGTH(TRIM(name)) < 2;

-- 3. クリーンアップ後の統計
SELECT 
  'Total campaigns' as description,
  COUNT(*) as count
FROM campaigns
UNION ALL
SELECT 
  'Campaigns with clean names' as description,
  COUNT(*) as count
FROM campaigns
WHERE name !~ '[\d,，]+\.?\d*[P円ポイントpt%％]|【.*】|\([^)]*\)|最大|倍|up\s*to'
UNION ALL
SELECT 
  'Unique clean campaign names' as description,
  COUNT(DISTINCT name) as count
FROM campaigns
WHERE name !~ '[\d,，]+\.?\d*[P円ポイントpt%％]|【.*】|\([^)]*\)|最大|倍|up\s*to';

-- 4. サンプル表示（クリーンアップ後）
SELECT name, cashback_rate, point_site_id
FROM campaigns 
WHERE name ILIKE '%楽天%'
ORDER BY name
LIMIT 10;