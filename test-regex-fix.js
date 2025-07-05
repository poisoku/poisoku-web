// 修正された正規表現のテスト

const testTexts = [
  "最大62327ポイント",
  "62327ポイント", 
  "327pt",
  "1,234ポイント",
  "最大1,234,567ポイント"
];

console.log('🧪 正規表現テスト:');

testTexts.forEach(text => {
  const match = text.match(/(?:最大)?([\d,]+)(?:ちょび)?(?:ポイント|pt)/);
  console.log(`"${text}" → ${match ? match[1] + 'ポイント' : 'マッチなし'}`);
});