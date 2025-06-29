-- ポイントサイトテーブル
CREATE TABLE point_sites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  url VARCHAR(500) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('major', 'gaming', 'survey', 'cashback')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 案件テーブル
CREATE TABLE campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  point_site_id UUID NOT NULL REFERENCES point_sites(id) ON DELETE CASCADE,
  cashback_rate VARCHAR(50) NOT NULL,
  device VARCHAR(50) NOT NULL CHECK (device IN ('PC', 'iOS', 'Android', 'All', 'iOS/Android')),
  campaign_url VARCHAR(1000),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(name, point_site_id, device)
);

-- 検索履歴テーブル
CREATE TABLE search_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword VARCHAR(500) NOT NULL UNIQUE,
  search_count INTEGER DEFAULT 1,
  last_searched_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 還元率履歴テーブル
CREATE TABLE cashback_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  cashback_rate VARCHAR(50) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- インデックスの作成
CREATE INDEX idx_campaigns_name ON campaigns(name);
CREATE INDEX idx_campaigns_point_site_id ON campaigns(point_site_id);
CREATE INDEX idx_campaigns_updated_at ON campaigns(updated_at DESC);
CREATE INDEX idx_search_history_keyword ON search_history(keyword);
CREATE INDEX idx_search_history_search_count ON search_history(search_count DESC);
CREATE INDEX idx_cashback_history_campaign_id ON cashback_history(campaign_id);
CREATE INDEX idx_cashback_history_recorded_at ON cashback_history(recorded_at DESC);

-- 更新時刻を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_point_sites_updated_at BEFORE UPDATE ON point_sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- サンプルデータの挿入
INSERT INTO point_sites (name, url, category, description) VALUES
  ('ハピタス', 'https://hapitas.jp', 'major', '高還元率で人気No.1'),
  ('モッピー', 'https://moppy.jp', 'major', '案件数が豊富'),
  ('ポイントインカム', 'https://pointi.jp', 'major', '会員ランク制度が充実'),
  ('ちょびリッチ', 'https://chobirich.com', 'major', 'ショッピング案件に強い'),
  ('ポイントタウン', 'https://pointtown.com', 'major', 'GMOグループ運営で安心');