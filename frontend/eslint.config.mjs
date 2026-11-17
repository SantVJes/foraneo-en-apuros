import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // La web es estática: los datos se piden a la API al montar cada pantalla (useEffect + fetch).
      "react-hooks/set-state-in-effect": "off",
      // Las fotos vienen de TheMealDB y la exportación estática no optimiza imágenes.
      "@next/next/no-img-element": "off",
      // Las fuentes se cargan una vez en el layout raíz (App Router), no por página.
      "@next/next/no-page-custom-font": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
