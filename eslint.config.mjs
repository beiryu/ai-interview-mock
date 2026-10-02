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
      // AudioWorklet scripts run in the worklet global scope
      "public/worklets/**",
      "next-env.d.ts",
    ],
  },
]

export default eslintConfig
