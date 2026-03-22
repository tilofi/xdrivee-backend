module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: [
    "eslint:recommended",
  ],
  parserOptions: {
    ecmaVersion: 2021,
  },
  rules: {
    // We don't want style rules to block backend progress
    "require-jsdoc": "off",
    "max-len": "off",
    "object-curly-spacing": "off",
    "indent": "off",
    "comma-dangle": "off",

    // Keep real-safety rules
    "no-unused-vars": ["error", { argsIgnorePattern: "req|res|next" }],
  },
};
