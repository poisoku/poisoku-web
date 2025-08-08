// ESLint規則: 動的インポートの制限
module.exports = {
  rules: {
    // 危険な動的インポートパターンを警告
    'no-restricted-syntax': [
      'warn',
      {
        selector: "CallExpression[callee.type='Import'][arguments.0.type='TemplateLiteral']",
        message: '動的なインポートパスは避けてください。静的インポートまたはNext.js dynamicを使用してください。'
      },
      {
        selector: "AwaitExpression > CallExpression[callee.type='Import']",
        message: 'クライアントサイドでの await import() は避けてください。静的インポートを使用してください。'
      }
    ],
    
    // useEffectでの動的インポートを警告
    'react-hooks/exhaustive-deps': ['warn', {
      'additionalHooks': 'useEffect'
    }]
  }
};