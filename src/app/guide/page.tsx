import Link from 'next/link';
import Header from '@/components/Header';

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />

      {/* メインコンテンツ */}
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-600 mb-2">ポイ速の使い方</h2>
          <p className="text-gray-600">
            ポイ速を効率的に使うための詳しい操作方法や機能について説明します。
          </p>
        </div>

        {/* 説明コンテンツ */}
        <div className="space-y-8">
          {/* ポイ速とは */}
          <section className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-600 mb-4">ポイ速とは？</h3>
            <p className="text-gray-700 leading-relaxed">
              ポイ速は、複数のポイントサイトから案件を検索し、還元率の高い順に表示する検索エンジンです。
              お買い物やサービス利用の前に検索することで、最もお得なポイントサイトを簡単に見つけることができます。
            </p>
          </section>

          {/* 使い方 */}
          <section className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-600 mb-4">使い方</h3>
            <ol className="space-y-3 list-decimal list-inside text-gray-700">
              <li>検索窓に利用したいサービス名や店舗名を入力します（例：Yahoo!ショッピング）</li>
              <li>検索ボタンをクリックすると、各ポイントサイトの還元率が高い順に表示されます</li>
              <li>気になる案件をクリックすると、該当のポイントサイトへ移動できます</li>
              <li>設定ページで検索対象のポイントサイトを選択・除外できます</li>
              <li>ランキングページで人気の検索キーワードを確認できます</li>
            </ol>
          </section>

          {/* 検索のコツ */}
          <section className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-600 mb-4">検索のコツ</h3>
            <div className="space-y-3 text-gray-700">
              <div>
                <h4 className="font-semibold mb-1">AND検索について</h4>
                <p>スペースで単語を区切ると AND 検索になります。</p>
                <ul className="list-disc list-inside ml-4 mt-2 text-sm">
                  <li>「Yahoo!ショッピング」で検索 → 「Yahoo!ショッピング」がヒット</li>
                  <li>「Yahoo! ショッピング」で検索 → 「Yahoo!ショッピング」と「Yahoo! ショッピング」両方がヒット</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-1">検索の仕様</h4>
                <p>大文字/小文字、全角/半角、ひらがな/カタカナ、濁点の有無を区別しません。</p>
              </div>
            </div>
          </section>

          {/* デバイス種別 */}
          <section className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-600 mb-4">デバイス種別について</h3>
            <p className="text-gray-700 mb-3">案件によって利用可能なデバイスが限定されている場合があります。</p>
            <ul className="space-y-2 text-gray-700">
              <li><span className="font-semibold">PC</span> = パソコンのみ対応</li>
              <li><span className="font-semibold">iOS</span> = iPhoneやiPadのみ対応</li>
              <li><span className="font-semibold">Android</span> = Androidスマートフォン・タブレットのみ対応</li>
              <li><span className="font-semibold">iOS/Android</span> = スマートフォン・タブレット対応（PCは非対応）</li>
              <li><span className="font-semibold">All</span> = すべてのデバイスに対応</li>
            </ul>
          </section>

          {/* 独自機能 */}
          <section className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200">
            <h3 className="text-xl font-bold text-gray-600 mb-4">ポイ速の便利機能</h3>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✨</span>
                <div>
                  <span className="font-semibold">1週間の最高額表示</span>
                  <p className="text-sm mt-1">検索結果の上部に、過去7日間で最も高かった還元率とそのポイントサイトを表示します。</p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✨</span>
                <div>
                  <span className="font-semibold">人気案件を発見</span>
                  <p className="text-sm mt-1">カテゴリー別ランキングで話題の案件をチェックできます。</p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✨</span>
                <div>
                  <span className="font-semibold">かんたん検索</span>
                  <p className="text-sm mt-1">案件名を入力するだけで一発検索。スペースで区切るとAND検索ができます。</p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✨</span>
                <div>
                  <span className="font-semibold">カテゴリー別ランキング</span>
                  <p className="text-sm mt-1">ショッピング、旅行、アプリ、クレカ、マネー、エンタメの6つのカテゴリーで案件をチェックできます。</p>
                </div>
              </li>
            </ul>
          </section>

          {/* 注意事項 */}
          <section className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-600 mb-4">ご利用にあたって</h3>
            <ul className="space-y-2 text-gray-700 text-sm">
              <li>• 還元率は各ポイントサイトの換金レート適用後の値です</li>
              <li>• 検索結果は定期的に更新されますが、最新情報は各ポイントサイトでご確認ください</li>
              <li>• ポイントサイトの利用には各サイトへの会員登録が必要です</li>
              <li>• 案件の条件や注意事項は必ず各ポイントサイトでご確認ください</li>
            </ul>
          </section>
        </div>
      </main>

      {/* フッター */}
      <footer className="bg-gray-50 mt-20">
        <div className="container mx-auto max-w-6xl px-4 py-12">
          <div className="text-center text-sm text-gray-500">
            <p>© 2025 ポイ速. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}