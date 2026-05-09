module.exports = {
  "ignore": [
    "**/*.test.ts",
    "**/*.test.js",
    "**/*.spec.ts",
    "**/*.spec.js",
    "**/__tests__/**",
    "**/dist/**",
    "**/coverage/**",
    "**/.next/**",
    "**/build/**"
  ],
  "languages": [
    "typescript",
    "javascript"
  ],
  "output": "ribbit/",
  "chunkThreshold": 200,
  "includeTests": false,
  "includeDotFiles": false
};
