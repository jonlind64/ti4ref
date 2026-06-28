import { defineConfig } from "vite";

export default defineConfig({
  // Relative URLs allow the generated PHP package to work from any one.com
  // subdomain document root without knowing its hostname at build time.
  base: "./"
});
