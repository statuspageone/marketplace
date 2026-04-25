import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import yaml from "js-yaml";

const smokeRoot = path.resolve(import.meta.dirname, "..");
const validatorScript = path.join(smokeRoot, "scripts", "validate-apps.mjs");
const sourceTemplateRoot = path.join(smokeRoot, "templates", "source");
const destTemplateRoot = path.join(smokeRoot, "templates", "destination");

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const writeYaml = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, yaml.dump(value, { noRefs: true, lineWidth: -1 }));
};

const runValidator = (root) =>
  spawnSync("node", [validatorScript, "--root", root], { encoding: "utf8" });

const assertPathExists = (targetPath, context) => {
  assert.equal(fs.existsSync(targetPath), true, `${context} should exist.`);
};

const assertFileContains = (targetPath, expectedText, context) => {
  const content = fs.readFileSync(targetPath, "utf8");
  assert.match(content, new RegExp(expectedText), `${context} should mention ${expectedText}.`);
};

const assertSuccess = (result, context) => {
  assert.equal(result.status, 0, `${context} should pass.\n${result.stdout}\n${result.stderr}`);
};

const assertFailure = (result, expectedText, context) => {
  assert.notEqual(result.status, 0, `${context} should fail.`);
  assert.match(
    `${result.stdout}\n${result.stderr}`,
    new RegExp(expectedText),
    `${context} should mention ${expectedText}.`,
  );
};

// --- Fixture builder ---

const buildRepo = ({ mutateApp } = {}) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "marketplace-smoke-"));
  for (const dir of ["apps", "schemas", "docs", "templates", "scripts"]) {
    fs.mkdirSync(path.join(tempRoot, dir), { recursive: true });
  }

  // Copy schemas so the validator can load them
  fs.cpSync(path.join(smokeRoot, "schemas"), path.join(tempRoot, "schemas"), { recursive: true });

  const appRoot = path.join(tempRoot, "apps", "demo-provider");

  const appFiles = {
    "manifest.yaml": {
      slug: "demo-provider",
      name: "Demo Provider",
      description: "Sanitized example source for validation smoke tests.",
      documentationUrl: "https://example.com/docs",
      version: "1.0.0",
      capabilities: ["source"],
    },
    "auth.yaml": {
      strategy: "oauth",
      oauth: {
        authorizationUrl: "https://example.com/oauth/authorize",
        tokenUrl: "https://example.com/oauth/token",
        scopes: ["events.read"],
        clientIdEnvVar: "SP1_EXAMPLE_CLIENT_ID",
        clientSecretEnvVar: "SP1_EXAMPLE_CLIENT_SECRET",
      },
    },
    "README.md": "# Demo Provider\nReplace this placeholder with real documentation.\n",
    "source/webhook.yaml": {
      subscriptionUrl: "https://api.example.com/webhooks",
      events: ["incident.created"],
      fixturePath: "fixtures/webhook-event.json",
    },
    "source/mapping.yaml": {
      events: [
        {
          sourceEvent: "incident.created",
          description: "Maps provider incident creation events into the normalized source-event shape.",
          fieldMappings: {
            provider: { literal: "demo-provider" },
            provider_event_type: { literal: "incident.created" },
            status: { literal: "open" },
            severity: { literal: "high" },
            title: { sourcePath: "data.title" },
            resource_id: { sourcePath: "data.id" },
            occurred_at: { sourcePath: "data.created_at" },
          },
        },
      ],
    },
    "source/fixtures/webhook-event.json": {
      id: "evt_example_redacted",
      type: "incident.created",
      data: {
        id: "inc_example_redacted",
        title: "Example incident",
        created_at: "2026-03-20T10:00:00Z",
      },
    },
  };

  for (const [relativePath, value] of Object.entries(appFiles)) {
    const filePath = path.join(appRoot, relativePath);
    if (relativePath.endsWith(".md")) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, value);
    } else if (relativePath.endsWith(".yaml")) {
      writeYaml(filePath, value);
    } else {
      writeJson(filePath, value);
    }
  }

  if (mutateApp) {
    mutateApp({ tempRoot, appRoot, writeJson, writeYaml });
  }

  return tempRoot;
};

// --- Tests ---

// 1. Valid source app passes
const validRoot = buildRepo();
assertSuccess(runValidator(validRoot), "valid source app");

// 2. Missing required manifest field fails
const missingNameRoot = buildRepo({
  mutateApp: ({ appRoot, writeYaml }) => {
    writeYaml(path.join(appRoot, "manifest.yaml"), {
      slug: "demo-provider",
      description: "Missing name field.",
      documentationUrl: "https://example.com/docs",
      version: "1.0.0",
      capabilities: ["source"],
    });
  },
});
assertFailure(runValidator(missingNameRoot), "manifest.yaml", "missing required field");

// 3. Secret-like value in auth fails
const secretLeakRoot = buildRepo({
  mutateApp: ({ appRoot, writeYaml }) => {
    writeYaml(path.join(appRoot, "auth.yaml"), {
      strategy: "oauth",
      oauth: {
        authorizationUrl: "https://example.com/oauth/authorize",
        tokenUrl: "https://example.com/oauth/token",
        scopes: ["events.read"],
        clientIdEnvVar: "SP1_EXAMPLE_CLIENT_ID",
        clientSecretEnvVar: "sk_live_1234567890",
      },
    });
  },
});
assertFailure(runValidator(secretLeakRoot), "secret", "secret-like value in auth");

// 4. Undeclared source/ directory (orphan) fails
const orphanRoot = buildRepo({
  mutateApp: ({ appRoot, writeYaml }) => {
    writeYaml(path.join(appRoot, "manifest.yaml"), {
      slug: "demo-provider",
      name: "Demo Provider",
      description: "Sanitized example.",
      documentationUrl: "https://example.com/docs",
      version: "1.0.0",
      capabilities: [],
    });
  },
});
assertFailure(runValidator(orphanRoot), "source", "orphan source/ directory");

// 5. Unknown capability string fails
const unknownCapRoot = buildRepo({
  mutateApp: ({ appRoot, writeYaml }) => {
    writeYaml(path.join(appRoot, "manifest.yaml"), {
      slug: "demo-provider",
      name: "Demo Provider",
      description: "Sanitized example.",
      documentationUrl: "https://example.com/docs",
      version: "1.0.0",
      capabilities: ["trigger"],
    });
  },
});
assertFailure(runValidator(unknownCapRoot), "unknown", "unknown capability string");

// 6. webhook_url strategy on source-only app fails
const badStrategyRoot = buildRepo({
  mutateApp: ({ appRoot, writeYaml }) => {
    writeYaml(path.join(appRoot, "auth.yaml"), {
      strategy: "webhook_url",
      webhook_url: {
        field: "webhook_url",
        label: "Webhook URL",
        pattern: "^https://",
      },
    });
  },
});
assertFailure(runValidator(badStrategyRoot), "webhook_url", "webhook_url on source-only app");

// 7. Missing required source field mapping fails
const missingSourceFieldRoot = buildRepo({
  mutateApp: ({ appRoot, writeYaml }) => {
    writeYaml(path.join(appRoot, "source/mapping.yaml"), {
      events: [
        {
          sourceEvent: "incident.created",
          fieldMappings: {
            provider: { literal: "demo-provider" },
            provider_event_type: { literal: "incident.created" },
            status: { literal: "open" },
            severity: { literal: "high" },
            resource_id: { sourcePath: "data.id" },
            occurred_at: { sourcePath: "data.created_at" },
          },
        },
      ],
    });
  },
});
assertFailure(runValidator(missingSourceFieldRoot), "title", "missing required source field mapping");

// 8. target_id mismatch fails
const mismatchRoot = buildRepo({
  mutateApp: ({ appRoot, writeYaml, writeJson }) => {
    writeYaml(path.join(appRoot, "manifest.yaml"), {
      slug: "demo-provider",
      name: "Demo Provider",
      description: "Sanitized example.",
      documentationUrl: "https://example.com/docs",
      version: "1.0.0",
      capabilities: ["destination"],
    });
    // Remove source/ dir since capability is now destination-only
    fs.rmSync(path.join(appRoot, "source"), { recursive: true, force: true });
    writeYaml(path.join(appRoot, "destination/targets.yaml"), {
      targets: [{ id: "channel", name: "Example Channel", description: "Example." }],
    });
    writeYaml(path.join(appRoot, "destination/webhook.yaml"), {
      target_id: "does-not-exist",
      http: { method: "POST", url: "{{installation.webhook_url}}", body_type: "json", body_template: "{}" },
      success_codes: [200],
    });
    writeJson(path.join(appRoot, "destination/fixtures/test-message.json"), { content: "example" });
  },
});
assertFailure(runValidator(mismatchRoot), "target_id", "mismatched target_id");

// 9. source template files exist at new locations
const sourceTemplateFiles = [
  "manifest.yaml",
  "auth.yaml",
  "README.md",
  "source/webhook.yaml",
  "source/polling.yaml",
  "source/mapping.yaml",
  "source/fixtures/webhook-event.json",
  "source/fixtures/polling-page.json",
];
for (const relativePath of sourceTemplateFiles) {
  assertPathExists(path.join(sourceTemplateRoot, relativePath), `source template ${relativePath}`);
}
assertFileContains(path.join(sourceTemplateRoot, "README.md"), "replace|placeholder", "source template README");

// 10. destination template files exist at new locations
const destTemplateFiles = [
  "manifest.yaml",
  "auth.yaml",
  "README.md",
  "destination/targets.yaml",
  "destination/webhook.yaml",
  "destination/fixtures/test-message.json",
];
for (const relativePath of destTemplateFiles) {
  assertPathExists(path.join(destTemplateRoot, relativePath), `destination template ${relativePath}`);
}

// 11. Copying source template to apps/ passes validation
const templateValidationRoot = fs.mkdtempSync(path.join(os.tmpdir(), "marketplace-template-"));
for (const dir of ["apps", "schemas"]) {
  fs.mkdirSync(path.join(templateValidationRoot, dir), { recursive: true });
}
fs.cpSync(path.join(smokeRoot, "schemas"), path.join(templateValidationRoot, "schemas"), { recursive: true });
fs.cpSync(sourceTemplateRoot, path.join(templateValidationRoot, "apps", "template-provider"), { recursive: true });
assertSuccess(runValidator(templateValidationRoot), "source template copy");

// 12. Real apps pass validation — keep this count in sync with checked-in example apps
const realAppsResult = runValidator(smokeRoot);
assertSuccess(realAppsResult, "all real apps");
assert.match(
  realAppsResult.stdout,
  /PASS \(1 apps\)/,
  "validator should report exactly 1 real app after adding the Axiom reference app",
);

console.log("PASS");
