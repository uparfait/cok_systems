const eslintJS = require("@eslint/js");
const globals = require("globals"); // We use this to get Node.js global variables

module.exports = [
  eslintJS.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      // This tells ESLint that code runs in a Node environment (enables require, module, console, etc.)
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // 1. Limit total lines in a file to 200, but ignore blank lines and comments
      "max-lines": ["error", { 
        "max": 500, 
        "skipBlankLines": true, 
        "skipComments": true 
      }],
    }
  }
];