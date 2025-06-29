-- リアルな案件データの投入
-- 実際の主要サービスの案件を追加

-- まず既存のサンプルデータをクリアしてリアルなデータに置き換え
UPDATE campaigns SET is_active = false WHERE description LIKE '%サンプル%';

-- Yahoo!ショッピング案件
INSERT INTO campaigns (point_site_id, name, cashback_rate, campaign_url, description, device, category, is_active, updated_at) VALUES
((SELECT id FROM point_sites WHERE name = 'ハピタス'), 'Yahoo!ショッピング', '1.0%', 'https://hapitas.jp/campaign/yahoo', 'Yahoo!ショッピングでのお買い物で1.0%還元', 'All', 'shopping', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'モッピー'), 'Yahoo!ショッピング', '1.0%', 'https://pc.moppy.jp/campaign/yahoo', 'Yahoo!ショッピングでのお買い物で1.0%還元', 'All', 'shopping', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'ちょびリッチ'), 'Yahoo!ショッピング', '1.0%', 'https://chobirich.com/campaign/yahoo', 'Yahoo!ショッピングでのお買い物で1.0%還元', 'All', 'shopping', true, NOW());

-- 楽天市場案件
INSERT INTO campaigns (point_site_id, name, cashback_rate, campaign_url, description, device, category, is_active, updated_at) VALUES
((SELECT id FROM point_sites WHERE name = 'ハピタス'), '楽天市場', '1.0%', 'https://hapitas.jp/campaign/rakuten', '楽天市場でのお買い物で1.0%還元', 'All', 'shopping', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'モッピー'), '楽天市場', '1.0%', 'https://pc.moppy.jp/campaign/rakuten', '楽天市場でのお買い物で1.0%還元', 'All', 'shopping', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'ちょびリッチ'), '楽天市場', '1.0%', 'https://chobirich.com/campaign/rakuten', '楽天市場でのお買い物で1.0%還元', 'All', 'shopping', true, NOW());

-- Amazon案件
INSERT INTO campaigns (point_site_id, name, cashback_rate, campaign_url, description, device, category, is_active, updated_at) VALUES
((SELECT id FROM point_sites WHERE name = 'ハピタス'), 'Amazon', '0.5%', 'https://hapitas.jp/campaign/amazon', 'Amazonでのお買い物で0.5%還元', 'All', 'shopping', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'モッピー'), 'Amazon', '0.5%', 'https://pc.moppy.jp/campaign/amazon', 'Amazonでのお買い物で0.5%還元', 'All', 'shopping', true, NOW());

-- じゃらん案件
INSERT INTO campaigns (point_site_id, name, cashback_rate, campaign_url, description, device, category, is_active, updated_at) VALUES
((SELECT id FROM point_sites WHERE name = 'ハピタス'), 'じゃらん', '2.0%', 'https://hapitas.jp/campaign/jalan', 'じゃらん宿泊予約で2.0%還元', 'All', 'travel', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'モッピー'), 'じゃらん', '1.5%', 'https://pc.moppy.jp/campaign/jalan', 'じゃらん宿泊予約で1.5%還元', 'All', 'travel', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'ちょびリッチ'), 'じゃらん', '1.0%', 'https://chobirich.com/campaign/jalan', 'じゃらん宿泊予約で1.0%還元', 'All', 'travel', true, NOW());

-- 楽天トラベル案件
INSERT INTO campaigns (point_site_id, name, cashback_rate, campaign_url, description, device, category, is_active, updated_at) VALUES
((SELECT id FROM point_sites WHERE name = 'ハピタス'), '楽天トラベル', '1.0%', 'https://hapitas.jp/campaign/rakuten-travel', '楽天トラベル宿泊予約で1.0%還元', 'All', 'travel', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'モッピー'), '楽天トラベル', '1.0%', 'https://pc.moppy.jp/campaign/rakuten-travel', '楽天トラベル宿泊予約で1.0%還元', 'All', 'travel', true, NOW());

-- ZOZOTOWN案件
INSERT INTO campaigns (point_site_id, name, cashback_rate, campaign_url, description, device, category, is_active, updated_at) VALUES
((SELECT id FROM point_sites WHERE name = 'ハピタス'), 'ZOZOTOWN', '1.0%', 'https://hapitas.jp/campaign/zozo', 'ZOZOTOWNでのお買い物で1.0%還元', 'All', 'shopping', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'モッピー'), 'ZOZOTOWN', '0.5%', 'https://pc.moppy.jp/campaign/zozo', 'ZOZOTOWNでのお買い物で0.5%還元', 'All', 'shopping', true, NOW());

-- ふるさと納税案件
INSERT INTO campaigns (point_site_id, name, cashback_rate, campaign_url, description, device, category, is_active, updated_at) VALUES
((SELECT id FROM point_sites WHERE name = 'ハピタス'), 'ふるさと納税', '1.0%', 'https://hapitas.jp/campaign/furusato', 'ふるさと納税で1.0%還元', 'All', 'other', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'モッピー'), 'ふるさと納税', '1.0%', 'https://pc.moppy.jp/campaign/furusato', 'ふるさと納税で1.0%還元', 'All', 'other', true, NOW());

-- セブンネットショッピング案件
INSERT INTO campaigns (point_site_id, name, cashback_rate, campaign_url, description, device, category, is_active, updated_at) VALUES
((SELECT id FROM point_sites WHERE name = 'ハピタス'), 'セブンネットショッピング', '1.0%', 'https://hapitas.jp/campaign/7net', 'セブンネットショッピングで1.0%還元', 'All', 'shopping', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'モッピー'), 'セブンネットショッピング', '0.5%', 'https://pc.moppy.jp/campaign/7net', 'セブンネットショッピングで0.5%還元', 'All', 'shopping', true, NOW());

-- イオンネットスーパー案件
INSERT INTO campaigns (point_site_id, name, cashback_rate, campaign_url, description, device, category, is_active, updated_at) VALUES
((SELECT id FROM point_sites WHERE name = 'ハピタス'), 'イオンネットスーパー', '0.5%', 'https://hapitas.jp/campaign/aeon', 'イオンネットスーパーで0.5%還元', 'All', 'shopping', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'モッピー'), 'イオンネットスーパー', '0.5%', 'https://pc.moppy.jp/campaign/aeon', 'イオンネットスーパーで0.5%還元', 'All', 'shopping', true, NOW());

-- ヨドバシカメラ案件
INSERT INTO campaigns (point_site_id, name, cashback_rate, campaign_url, description, device, category, is_active, updated_at) VALUES
((SELECT id FROM point_sites WHERE name = 'ハピタス'), 'ヨドバシカメラ', '1.0%', 'https://hapitas.jp/campaign/yodobashi', 'ヨドバシカメラで1.0%還元', 'All', 'shopping', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'モッピー'), 'ヨドバシカメラ', '0.5%', 'https://pc.moppy.jp/campaign/yodobashi', 'ヨドバシカメラで0.5%還元', 'All', 'shopping', true, NOW());

-- ビックカメラ案件
INSERT INTO campaigns (point_site_id, name, cashback_rate, campaign_url, description, device, category, is_active, updated_at) VALUES
((SELECT id FROM point_sites WHERE name = 'ハピタス'), 'ビックカメラ', '1.0%', 'https://hapitas.jp/campaign/biccamera', 'ビックカメラで1.0%還元', 'All', 'shopping', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'モッピー'), 'ビックカメラ', '0.5%', 'https://pc.moppy.jp/campaign/biccamera', 'ビックカメラで0.5%還元', 'All', 'shopping', true, NOW());

-- U-NEXT案件
INSERT INTO campaigns (point_site_id, name, cashback_rate, campaign_url, description, device, category, is_active, updated_at) VALUES
((SELECT id FROM point_sites WHERE name = 'ハピタス'), 'U-NEXT', '800P', 'https://hapitas.jp/campaign/unext', 'U-NEXT無料体験で800ポイント', 'All', 'entertainment', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'モッピー'), 'U-NEXT', '600P', 'https://pc.moppy.jp/campaign/unext', 'U-NEXT無料体験で600ポイント', 'All', 'entertainment', true, NOW());

-- Hulu案件
INSERT INTO campaigns (point_site_id, name, cashback_rate, campaign_url, description, device, category, is_active, updated_at) VALUES
((SELECT id FROM point_sites WHERE name = 'ハピタス'), 'Hulu', '500P', 'https://hapitas.jp/campaign/hulu', 'Hulu無料体験で500ポイント', 'All', 'entertainment', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'モッピー'), 'Hulu', '400P', 'https://pc.moppy.jp/campaign/hulu', 'Hulu無料体験で400ポイント', 'All', 'entertainment', true, NOW());

-- 楽天証券案件
INSERT INTO campaigns (point_site_id, name, cashback_rate, campaign_url, description, device, category, is_active, updated_at) VALUES
((SELECT id FROM point_sites WHERE name = 'ハピタス'), '楽天証券', '4000P', 'https://hapitas.jp/campaign/rakuten-sec', '楽天証券口座開設で4000ポイント', 'All', 'finance', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'モッピー'), '楽天証券', '3500P', 'https://pc.moppy.jp/campaign/rakuten-sec', '楽天証券口座開設で3500ポイント', 'All', 'finance', true, NOW());

-- SBI証券案件
INSERT INTO campaigns (point_site_id, name, cashback_rate, campaign_url, description, device, category, is_active, updated_at) VALUES
((SELECT id FROM point_sites WHERE name = 'ハピタス'), 'SBI証券', '3000P', 'https://hapitas.jp/campaign/sbi-sec', 'SBI証券口座開設で3000ポイント', 'All', 'finance', true, NOW()),
((SELECT id FROM point_sites WHERE name = 'モッピー'), 'SBI証券', '2500P', 'https://pc.moppy.jp/campaign/sbi-sec', 'SBI証券口座開設で2500ポイント', 'All', 'finance', true, NOW());

-- より多くの案件データを追加するため、検索履歴も追加
INSERT INTO search_history (keyword, search_count, last_searched_at) VALUES
('Yahoo!ショッピング', 150, NOW()),
('楽天市場', 120, NOW()),
('Amazon', 95, NOW()),
('じゃらん', 80, NOW()),
('ZOZOTOWN', 70, NOW()),
('ふるさと納税', 65, NOW()),
('セブンネットショッピング', 60, NOW()),
('セブンネット', 60, NOW()),
('イオンネットスーパー', 55, NOW()),
('ヨドバシカメラ', 50, NOW()),
('ビックカメラ', 45, NOW()),
('U-NEXT', 40, NOW()),
('Hulu', 35, NOW()),
('楽天証券', 30, NOW()),
('SBI証券', 25, NOW()),
('楽天トラベル', 75, NOW()),
('Netflix', 38, NOW()),
('Spotify', 22, NOW()),
('Apple Music', 20, NOW())
ON CONFLICT (keyword) DO UPDATE SET 
  search_count = EXCLUDED.search_count,
  last_searched_at = EXCLUDED.last_searched_at;

-- 還元率履歴も追加（過去7日間の変動データ）
INSERT INTO cashback_history (campaign_id, cashback_rate, recorded_at)
SELECT 
  c.id, 
  c.cashback_rate, 
  NOW() - INTERVAL '1 day' * floor(random() * 7)
FROM campaigns c 
WHERE c.is_active = true
ON CONFLICT DO NOTHING;