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

const requireFileContains = (relativePath, expectedText, description) => {
  const fullPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(fullPath)) {
    failures.push(`Missing ${relativePath}`);
    return;
  }

  const content = fs.readFileSync(fullPath, "utf8");
  if (!content.includes(expectedText)) {
    failures.push(description);
  }
};

requirePath("README.md");
requirePackageScript("validate");

for (const folder of ["templates", "apps", "schemas", "scripts"]) {
  requirePath(folder, `top-level folder ${folder}/`);
}

const requiredMetaFiles = [
  ".github/workflows/validate-apps.yml",
  ".github/pull_request_template.md",
];

for (const metaFilePath of requiredMetaFiles) {
  requirePath(metaFilePath);
}

requireFileContains("README.md", "pnpm validate", "README.md must mention local validation with pnpm validate");
requireFileContains("README.md", "pull request", "README.md must describe pull request expectations");

if (failures.length > 0) {
  console.error("FAIL");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("PASS");
