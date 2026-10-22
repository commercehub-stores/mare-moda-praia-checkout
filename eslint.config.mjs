import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  nextPlugin.configs["core-web-vitals"],
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    settings: { next: { rootDir: import.meta.dirname } },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
      // Product photos come from the VTEX image CDN and icons are tiny SVGs; next.config has images.unoptimized.
      "@next/next/no-img-element": "off",
      // Links back to the storefront zone ("/") must be plain <a>: next/link would add this zone's basePath.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
);
