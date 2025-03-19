import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended"
import globals from "globals";

export const configs = tseslint.config(
    eslint.configs.recommended,
    // https://typescript-eslint.io/users/configs/#recommended
    tseslint.configs.recommended,
    // https://typescript-eslint.io/users/configs/#stylistic
    tseslint.configs.stylistic,
    // https://typescript-eslint.io/users/what-about-formatting
    {
        languageOptions: {
            globals: {
                ...globals.node,
            }
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "warn"
        }
    },
    // https://github.com/prettier/eslint-plugin-prettier?tab=readme-ov-file#configuration-new-eslintconfigjs
    eslintPluginPrettierRecommended,
);

export const typecheckedConfigs = tseslint.config(
    eslint.configs.recommended,
    // https://typescript-eslint.io/users/configs/#recommended-type-checked
    tseslint.configs.recommendedTypeChecked,
    // https://typescript-eslint.io/users/configs/#stylistic-type-checked
    tseslint.configs.stylisticTypeChecked,
    // https://typescript-eslint.io/users/what-about-formatting
    {
        languageOptions: {
            globals: {
                ...globals.node,
            },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unsafe-assignment": "warn",
            "@typescript-eslint/restrict-template-expressions": "warn"
        }
    },
    // https://github.com/prettier/eslint-plugin-prettier?tab=readme-ov-file#configuration-new-eslintconfigjs
    eslintPluginPrettierRecommended,
);
