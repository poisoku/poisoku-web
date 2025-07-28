import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ポイ速 - ポイントサイト案件比較検索",
  description: "ポイントサイトの案件を一括検索・比較できるサービス",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <meta name="cache-control" content="no-cache, no-store, must-revalidate" />
        <meta name="pragma" content="no-cache" />
        <meta name="expires" content="0" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // キャッシュクリア関数
              window.clearSearchCache = function() {
                // Service Worker キャッシュをクリア
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for(let registration of registrations) {
                      registration.unregister();
                    }
                  });
                }
                
                // ローカルストレージとセッションストレージをクリア
                if (typeof Storage !== 'undefined') {
                  localStorage.clear();
                  sessionStorage.clear();
                }
                
                // ブラウザのキャッシュを強制リロード
                window.location.reload(true);
                
                alert('キャッシュをクリアしました。ページを再読み込みします。');
              };
              
              // 検索データの最新性をチェック
              window.checkDataFreshness = async function() {
                try {
                  const response = await fetch('/search-data.json?' + Date.now());
                  const data = await response.json();
                  const chobirichCount = data.campaigns.filter(c => c.siteName === 'ちょびリッチ').length;
                  alert('現在の検索データ: ' + data.campaigns.length + '件\\nちょびリッチ: ' + chobirichCount + '件');
                } catch (error) {
                  alert('データチェックエラー: ' + error.message);
                }
              };
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <button
            onClick={() => window.clearSearchCache?.()}
            style={{
              padding: '8px 12px',
              backgroundColor: '#ff6b6b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
            title="ブラウザキャッシュをクリアして最新データを取得"
          >
            🔄 キャッシュクリア
          </button>
          <button
            onClick={() => window.checkDataFreshness?.()}
            style={{
              padding: '8px 12px',
              backgroundColor: '#4ecdc4',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
            title="現在のデータ件数を確認"
          >
            📊 データ確認
          </button>
        </div>
      </body>
    </html>
  );
}
