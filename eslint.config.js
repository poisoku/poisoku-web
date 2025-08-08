import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // 動的インポートの制限ルール
      "no-restricted-syntax": [
        "warn",
        {
          selector: "CallExpression[callee.type='Import'][arguments.0.type='TemplateLiteral']",
          message: "動的なインポートパスは避けてください。静的インポートまたはNext.js dynamicを使用してください。"
        },
        {
          selector: "AwaitExpression > CallExpression[callee.type='Import']",
          message: "クライアントサイドでの await import() は避けてください。静的インポートを使用してください。"
        }
      ],
      
      // requireの混在使用を警告
      "no-restricted-globals": [
        "warn",
        {
          name: "require",
          message: "require() とESモジュールの混在は避けてください。一貫してimport文を使用してください。"
        }
      ]
    }
  }
];