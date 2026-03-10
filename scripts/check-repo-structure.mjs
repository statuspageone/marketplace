import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

const failures = [];

const requirePath = (relativePath, description = relativePath) => {
  const fullPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(fullPath)) {
    failures.push(`Missing ${description}`);
  }
};

const requirePackageScript = (scriptName) => {
  const packageJsonPath = path.join(repoRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    failures.push("Missing package.json");
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  if (!packageJson.scripts?.[scriptName]) {
    failures.push(`package.json must define scripts.${scriptName}`);
  }
};

requirePath("README.md");
requirePackageScript("validate");

for (const folder of ["docs", "templates", "connectors", "schemas", "scripts"]) {
  requirePath(folder, `top-level folder ${folder}/`);
}

if (failures.length > 0) {
  console.error("FAIL");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("PASS");
