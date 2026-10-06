// Downloads the 1.12 icon set into public/icons from the vanillawowdb (AoWoW) repository.
// The icons are Blizzard artwork: they stay out of git (see .gitignore). Run: npm run icons
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const REPO = "https://github.com/MarkusNemesis/vanillawowdb.git";
const SIZES = ["medium", "large"];

const dest = new URL("../public/icons/", import.meta.url);
const tmp = mkdtempSync(path.join(tmpdir(), "wow-icons-"));
const git = (...args) => execFileSync("git", args, { cwd: tmp, stdio: "inherit" });
try {
  // sparse + blobless: only the icon folders are fetched, not the 100 MB repository
  execFileSync("git", ["clone", "--depth", "1", "--filter=blob:none", "--sparse", REPO, tmp], { stdio: "inherit" });
  git("sparse-checkout", "set", ...SIZES.map((s) => `images/icons/${s}`));
  for (const size of SIZES) {
    cpSync(path.join(tmp, "images", "icons", size), new URL(`${size}/`, dest), { recursive: true });
    console.log(`${size}: ${readdirSync(new URL(`${size}/`, dest)).length} icons`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
