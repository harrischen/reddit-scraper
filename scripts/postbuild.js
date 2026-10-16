// postbuild: copy manifest.json to dist/
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

if (!fs.existsSync(dist)) {
  console.error("Error: dist/ directory not found. Run `npm run build` first.");
  process.exit(1);
}

fs.copyFileSync(path.join(root, "manifest.json"), path.join(dist, "manifest.json"));
console.log("✓ copied manifest.json");
