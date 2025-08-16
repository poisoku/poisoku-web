# ポイ速 仕様書：Moppyカテゴリ収集URL一覧
更新日: 2025-08-14 07:00:34 JST

---

## Web案件
https://pc.moppy.jp/category/list.php?parent_category=1&af_sorter=1&page=1
https://pc.moppy.jp/category/list.php?parent_category=2&af_sorter=1&page=1
https://pc.moppy.jp/category/list.php?parent_category=3&af_sorter=1&page=1
https://pc.moppy.jp/category/list.php?parent_category=4&af_sorter=1&page=1
https://pc.moppy.jp/category/list.php?parent_category=5&af_sorter=1&page=1
https://pc.moppy.jp/category/list.php?parent_category=6&af_sorter=1&page=1
https://pc.moppy.jp/category/list.php?parent_category=7&af_sorter=1&page=1
https://pc.moppy.jp/category/list.php?parent_category=8&af_sorter=1&page=1
https://pc.moppy.jp/category/list.php?parent_category=9&af_sorter=1&page=1
https://pc.moppy.jp/category/list.php?parent_category=10&af_sorter=1&page=1
---

## Web案件の留意事項
- 1ページに30案件掲載されている
- 31案件以上存在する場合は2ページ目以降も存在
- 2ページ目以降のURLは、`page=1`の数値を増やして取得できる  

---

## スマホアプリ案件
- https://pc.moppy.jp/category/list.php?parent_category=4&child_category=52&af_sorter=1&page=1

---

### スマホアプリ案件の留意事項
- 1ページに30案件掲載されている
- 31案件以上存在する場合は2ページ目以降も存在
- 2ページ目以降の取得方法について、案件掲載場所の下に「1」「2」「3」・・・と番号が付されたボタンが存在し、案件URLにアクセスした時点では「1」が選択されており、「2」をタップすると2ページ目の案件に切り替わり、「3」をタップすると3ページ目の案件に切り替わる・・・という仕様になっている。

---

### 還元ポイント表示ルール
1. **円換算表示**: モッピーは **1pt = 1円**
2. **% 案件**: そのまま % 表示
3. **換算処理**: ポイ速フロントエンドで実行