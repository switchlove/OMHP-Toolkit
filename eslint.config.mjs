import js from "@eslint/js";
import globals from "globals";

export default [
    js.configs.recommended,
    {
        files: ["omhp-toolkit.user.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "script",
            globals: {
                ...globals.browser,
                GM_info: "readonly", // provided by the userscript manager
            },
        },
        rules: {
            "no-unused-vars": ["warn", { caughtErrors: "none" }],
        },
    },
];
