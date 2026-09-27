import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/sensitive-map/" : "/",
  plugins: [react()],
  test: {
    environment: "node",
  },
}));
