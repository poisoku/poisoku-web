-- サンプル案件データ
-- まず、ポイントサイトのIDを確認
WITH site_ids AS (
  SELECT 
    id,
    name 
  FROM point_sites
)

-- Yahoo!ショッピングの案件
INSERT INTO campaigns (name, point_site_id, cashback_rate, device, campaign_url, description)
SELECT 
  'Yahoo!ショッピング',
  id,
  CASE name
    WHEN 'ハピタス' THEN '1.0%'
    WHEN 'モッピー' THEN '0.9%'
    WHEN 'ポイントインカム' THEN '0.8%'
    WHEN 'ちょびリッチ' THEN '0.7%'
    WHEN 'ポイントタウン' THEN '0.6%'
  END,
  'All',
  'https://shopping.yahoo.co.jp',
  CASE name
    WHEN 'ハピタス' THEN '初回購入で+500pt'
    WHEN 'モッピー' THEN 'PayPay支払いで+0.5%'
    ELSE NULL
  END
FROM site_ids
WHERE name IN ('ハピタス', 'モッピー', 'ポイントインカム', 'ちょびリッチ', 'ポイントタウン');

-- 楽天市場の案件
INSERT INTO campaigns (name, point_site_id, cashback_rate, device, campaign_url, description)
SELECT 
  '楽天市場',
  id,
  CASE name
    WHEN 'ハピタス' THEN '1.0%'
    WHEN 'モッピー' THEN '1.0%'
    WHEN 'ポイントインカム' THEN '1.0%'
    WHEN 'ちょびリッチ' THEN '1.0%'
    WHEN 'ポイントタウン' THEN '1.0%'
  END,
  'All',
  'https://www.rakuten.co.jp',
  '楽天スーパーセール時は還元率UP'
FROM site_ids
WHERE name IN ('ハピタス', 'モッピー', 'ポイントインカム', 'ちょびリッチ', 'ポイントタウン');

-- Amazonの案件（デバイス別）
INSERT INTO campaigns (name, point_site_id, cashback_rate, device, campaign_url, description)
SELECT 
  'Amazon',
  id,
  '0.5%',
  'PC',
  'https://www.amazon.co.jp',
  'ファッションカテゴリは2%'
FROM site_ids
WHERE name = 'ポイントインカム';

INSERT INTO campaigns (name, point_site_id, cashback_rate, device, campaign_url, description)
SELECT 
  'Amazon',
  id,
  '0.4%',
  'iOS/Android',
  'https://www.amazon.co.jp',
  'アプリ経由限定'
FROM site_ids
WHERE name = 'モッピー';

-- 検索履歴のサンプルデータ
INSERT INTO search_history (keyword, search_count) VALUES
  ('Yahoo!ショッピング', 1543),
  ('楽天市場', 1421),
  ('Amazon', 1398),
  ('PayPayモール', 1234),
  ('LOHACO', 1156),
  ('Qoo10', 1089),
  ('au PAY マーケット', 1045),
  ('ZOZOTOWN', 998),
  ('ユニクロ', 976),
  ('GU', 954);