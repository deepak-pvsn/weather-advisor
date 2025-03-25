module.exports = {
  extends: 'next/core-web-vitals',
  rules: {
    // Disable the rule for unescaped entities (quotes and apostrophes)
    'react/no-unescaped-entities': 'off',
    
    // Either disable or set to warn for exhaustive dependencies
    'react-hooks/exhaustive-deps': 'warn',
  }
}; 