// pack: auto-increment patch version and zip dist/ for Chrome Web Store upload
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

// --- Auto-increment patch version ---
const pkgPath = path.join(root, "package.json");
const manifestPath = path.join(root, "manifest.json");

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
const [major, minor, patch] = pkg.version.split(".").map(Number);
const newVersion = `${major}.${minor}.${patch + 1}`;

pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
console.log(`✓ package.json version: ${newVersion}`);

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
manifest.version = newVersion;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
console.log(`✓ manifest.json version: ${newVersion}`);

console.log(`\n→ Version bumped to ${newVersion}`);

// --- Rebuild with new version ---
console.log("\n→ Rebuilding...\n");
execSync("npm run build", { cwd: root, stdio: "inherit" });

// --- Create zip ---
const outName = `reddit-voc-scraper-v${newVersion}.zip`;
const outPath = path.join(root, outName);

if (!fs.existsSync(dist)) {
  console.error("Error: dist/ directory not found after build.");
  process.exit(1);
}

if (fs.existsSync(outPath)) {
  fs.unlinkSync(outPath);
}

execSync(`cd "${dist}" && zip -r "${outPath}" .`, { stdio: "inherit" });
console.log(`\n✓ Packaged: ${outName}`);
console.log("  Ready to upload to Chrome Web Store.");
