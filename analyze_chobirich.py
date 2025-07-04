import json

# JSONファイルを読み込む
with open('chobirich_all_categories_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 基本情報
print('=== 基本情報 ===')
print(f'スクレイピング日時: {data["scraped_at"]}')
print(f'総案件数: {data["total_campaigns"]}')
print()

# カテゴリー別の集計
category_count = {}
for campaign in data['campaigns']:
    category = campaign.get('category', '不明')
    category_count[category] = category_count.get(category, 0) + 1

print('=== カテゴリー別案件数 ===')
for category, count in sorted(category_count.items(), key=lambda x: x[1], reverse=True):
    print(f'{category}: {count}件')
print()

# 還元率タイプ別の集計
cashback_types = {
    'percent': 0,  # %還元
    'point': 0,    # pt還元
    'none': 0,     # なし
    'other': 0     # その他
}

# 還元率の詳細情報
cashback_details = {
    'percent': {},  # %還元の値別
    'point': {}     # pt還元の値別
}

for campaign in data['campaigns']:
    cashback = campaign.get('cashback', '')
    if cashback == 'なし':
        cashback_types['none'] += 1
    elif '%' in cashback:
        cashback_types['percent'] += 1
        # %の値を抽出
        cashback_details['percent'][cashback] = cashback_details['percent'].get(cashback, 0) + 1
    elif 'pt' in cashback or 'ポイント' in cashback:
        cashback_types['point'] += 1
        # ptの値を抽出
        cashback_details['point'][cashback] = cashback_details['point'].get(cashback, 0) + 1
    else:
        cashback_types['other'] += 1

print('=== 還元率タイプ別集計 ===')
print(f'%還元: {cashback_types["percent"]}件')
print(f'pt還元: {cashback_types["point"]}件')
print(f'なし: {cashback_types["none"]}件')
print(f'その他: {cashback_types["other"]}件')
print()

# %還元の詳細
if cashback_details['percent']:
    print('=== %還元の詳細（上位10件） ===')
    for cashback, count in sorted(cashback_details['percent'].items(), 
                                  key=lambda x: x[1], reverse=True)[:10]:
        print(f'{cashback}: {count}件')
    print()

# pt還元の詳細
if cashback_details['point']:
    print('=== pt還元の詳細（上位10件） ===')
    for cashback, count in sorted(cashback_details['point'].items(), 
                                  key=lambda x: x[1], reverse=True)[:10]:
        print(f'{cashback}: {count}件')
    print()

# データの整合性チェック
print('=== データ整合性チェック ===')
errors = []

# 必須フィールドのチェック
required_fields = ['id', 'name', 'cashback', 'category', 'url']
for i, campaign in enumerate(data['campaigns']):
    for field in required_fields:
        if field not in campaign or campaign[field] is None or campaign[field] == '':
            errors.append(f'案件 {i+1}: {field}フィールドが欠落または空')

# URLフォーマットのチェック
for i, campaign in enumerate(data['campaigns']):
    url = campaign.get('url', '')
    if url and not url.startswith('https://www.chobirich.com/ad_details/'):
        errors.append(f'案件 {i+1} ({campaign.get("name", "不明")}): 不正なURLフォーマット')

# IDの重複チェック
id_count = {}
for campaign in data['campaigns']:
    campaign_id = campaign.get('id')
    if campaign_id:
        id_count[campaign_id] = id_count.get(campaign_id, 0) + 1

duplicate_ids = [id for id, count in id_count.items() if count > 1]
if duplicate_ids:
    for dup_id in duplicate_ids:
        errors.append(f'ID {dup_id}: {id_count[dup_id]}回重複')

if errors:
    print(f'エラー数: {len(errors)}')
    for error in errors[:10]:  # 最初の10件のみ表示
        print(f'  - {error}')
    if len(errors) > 10:
        print(f'  ... 他 {len(errors) - 10} 件のエラー')
else:
    print('エラーは検出されませんでした')

# データ件数の確認
print()
print('=== データ整合性確認 ===')
print(f'total_campaignsフィールドの値: {data["total_campaigns"]}')
print(f'実際のcampaigns配列の長さ: {len(data["campaigns"])}')
if data["total_campaigns"] == len(data["campaigns"]):
    print('データ件数は一致しています')
else:
    print('警告: データ件数が一致していません')