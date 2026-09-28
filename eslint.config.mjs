import nextVitals from "eslint-config-next/core-web-vitals"
import prettier from "eslint-config-prettier/flat"
import tailwindcss from "eslint-plugin-tailwindcss"

const eslintConfig = [
  ...nextVitals,
  ...tailwindcss.configs["flat/recommended"],
  prettier,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "react/jsx-key": "off",
      "tailwindcss/no-custom-classname": "off",
      "tailwindcss/classnames-order": "off",
      "tailwindcss/no-unnecessary-arbitrary-value": "off",
      // React Compiler rules (react-hooks v7) flag pre-existing patterns;
      // keep them visible as warnings until those components are refactored.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
    settings: {
      tailwindcss: {
        callees: ["cn"],
        config: "tailwind.config.js",
      },
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "lib/generated/**",
      "next-env.d.ts",
    ],
  },
]

export default eslintConfig
