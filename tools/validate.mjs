import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "site/index.html", "site/testing/index.html", "site/assets/content.js", "site/assets/site.js", "site/assets/styles.css",
  ...[1, 2, 3, 4].map((number) => `site/testing/options/${number}/index.html`)
];
const errors = [];
for (const file of required) await access(path.join(repo, file)).catch(() => errors.push(`Missing ${file}`));

const homepage = await readFile(path.join(repo, "site/index.html"), "utf8");
const match = homepage.match(/<body data-design="([1-4])">/);
if (!match) errors.push("Homepage must select design 1, 2, 3, or 4.");
for (const asset of ["assets/styles.css", "assets/content.js", "assets/site.js"]) {
  if (!homepage.includes(asset)) errors.push(`Homepage does not load ${asset}`);
}
const styles = await readFile(path.join(repo, "site/assets/styles.css"), "utf8");
for (const number of [1, 2, 3, 4]) if (!styles.includes(`data-design=\"${number}\"`)) errors.push(`Missing CSS for design ${number}`);

if (errors.length) {
  console.error("Site check failed:\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`Site check passed. Homepage uses design ${match[1]}; all four testing options and shared assets are present.`);

