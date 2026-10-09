import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(async ({ command, mode }) => {
  const plugins: Awaited<ReturnType<typeof tanstackStart>> = [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
  ];

  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    if (process.env.VERCEL) {
      plugins.push(nitro({ preset: "vercel" }));
    } else {
      plugins.push(nitro({ defaultPreset: "cloudflare-module" }));
    }
  }

  plugins.push(viteReact());

  let envDefine: Record<string, string> = {};
  const isVercelBuild = process.env.VERCEL === "1";
  const loadedEnv = loadEnv(mode, process.cwd(), "VITE_");
  for (const [key, value] of Object.entries(loadedEnv)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    define: envDefine,
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    server: {
      host: "::",
      port: 8080,
    },
    build: isVercelBuild
      ? { outDir: ".vercel/output/static", emptyOutDir: true }
      : undefined,
    plugins,
  };
});
