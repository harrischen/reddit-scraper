/**
 * Vite 构建配置
 *
 * 要点：
 * - base: "./"：Chrome 扩展的 HTML/资源必须用相对路径
 * - @ 别名指向项目根目录（与 tsconfig 的 paths 对应）
 * - copyManifestPlugin：把 manifest.json 复制进 dist（挂在 writeBundle 上，
 *   让 build 和 dev/watch 每次重建都会复制，不会被 emptyOutDir 清掉）
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { copyFileSync } from "fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 把 manifest.json 复制进 dist。放在 vite 插件里（而不是 postbuild），
// 这样 `npm run dev`（vite build --watch）每次重建也会复制，不会被 emptyOutDir 清掉。
function copyManifestPlugin(): Plugin {
  return {
    name: "copy-manifest",
    writeBundle() {
      copyFileSync(
        resolve(__dirname, "manifest.json"),
        resolve(__dirname, "dist/manifest.json")
      );
    },
  };
}

export default defineConfig({
  base: "./", // Chrome 扩展必须用相对路径
  plugins: [react(), copyManifestPlugin()],
  resolve: {
    alias: {
      "@": resolve(__dirname),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    polyfillModulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "pages/popup/popup.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
});
