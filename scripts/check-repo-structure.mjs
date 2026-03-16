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

for (const folder of ["docs", "templates", "sources", "destinations", "schemas", "scripts"]) {
  requirePath(folder, `top-level folder ${folder}/`);
}

const requiredDocs = [
  "docs/authoring-guide.md",
  "docs/app-contract.md",
  "docs/security-and-redaction.md",
  "docs/review-checklist.md",
];

const requiredMetaFiles = [
  ".github/workflows/validate-apps.yml",
  ".github/pull_request_template.md",
];

for (const docPath of requiredDocs) {
  requirePath(docPath);
}

for (const metaFilePath of requiredMetaFiles) {
  requirePath(metaFilePath);
}

for (const docLink of requiredDocs) {
  requireFileContains("README.md", docLink, `README.md must link to ${docLink}`);
}

requireFileContains(
  "docs/security-and-redaction.md",
  "Do not include secrets or real customer data.",
  "security-and-redaction.md must explicitly forbid secrets and real customer data",
);

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
