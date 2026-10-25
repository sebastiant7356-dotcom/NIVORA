// Syntax-checks every .js file under src/, tests/ and scripts/ (no deps needed).
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}
let bad = 0;
for (const d of ["src", "tests", "scripts"]) {
  const full = path.join(__dirname, "..", d);
  if (!fs.existsSync(full)) continue;
  for (const f of walk(full)) {
    try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); }
    catch (e) { bad++; console.error("SYNTAX ERROR:", f, "\n", String(e.stderr || e.message)); }
  }
}
console.log(bad ? `${bad} file(s) with syntax errors` : "All files pass syntax check");
process.exit(bad ? 1 : 0);
