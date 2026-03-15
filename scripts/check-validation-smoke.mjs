import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import yaml from "js-yaml";

const smokeRoot = path.resolve(import.meta.dirname, "..");
const validatorScript = path.join(smokeRoot, "scripts", "validate-connectors.mjs");
const templateRoot = path.join(smokeRoot, "templates", "connector");
const resendRoot = path.join(smokeRoot, "connectors", "resend");

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const writeYaml = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, yaml.dump(value, { noRefs: true, lineWidth: -1 }));
};

const buildFixtureRepo = ({ mutateValidConnector } = {}) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "marketplace-smoke-"));
  const directories = ["connectors", "schemas", "docs", "templates", "scripts"];

  for (const directory of directories) {
    fs.mkdirSync(path.join(tempRoot, directory), { recursive: true });
  }

  const connectorRoot = path.join(tempRoot, "connectors", "demo-provider");

  const connectorFiles = {
    "manifest.yaml": {
      slug: "demo-provider",
      name: "Demo Provider",
      description: "Sanitized example connector for validation smoke tests.",
      documentationUrl: "https://example.com/docs",
      deliveryModes: ["webhook", "polling"],
      auth: "oauth2",
      files: {
        auth: "auth.yaml",
        webhook: "webhook.yaml",
        polling: "polling.yaml",
        mapping: "mapping.yaml",
      },
    },
    "auth.yaml": {
      strategy: "oauth2",
      oauth2: {
        authorizationUrl: "https://example.com/oauth/authorize",
        tokenUrl: "https://example.com/oauth/token",
        scopes: ["events.read"],
        clientIdEnvVar: "SP1_EXAMPLE_CLIENT_ID",
        clientSecretEnvVar: "SP1_EXAMPLE_CLIENT_SECRET",
      },
    },
    "webhook.yaml": {
      subscriptionUrl: "https://api.example.com/webhooks",
      signatureHeader: "x-demo-signature",
      events: ["incident.created"],
      fixturePath: "fixtures/webhook-event.json",
    },
    "polling.yaml": {
      endpoint: "https://api.example.com/incidents",
      itemsPath: "data.items",
      cursorField: "updated_at",
      pagination: {
        type: "cursor",
        nextCursorPath: "data.next_cursor",
      },
      fixturePath: "fixtures/polling-page.json",
    },
    "mapping.yaml": {
      routes: [
        {
          sourceEvent: "incident.created",
          canonicalRoute: "incident.created",
          eventType: "incident",
          description: "Maps provider incident creation events to the canonical route.",
        },
      ],
      fields: [
        {
          sourcePath: "data.id",
          canonicalField: "incident.id",
        },
      ],
    },
    "README.md": "# Demo Provider\n",
    "fixtures/webhook-event.json": {
      id: "evt_demo_123",
      type: "incident.created",
      data: {
        id: "inc_demo_123",
        title: "Demo incident",
      },
    },
    "fixtures/polling-page.json": {
      data: {
        items: [
          {
            id: "inc_demo_123",
            updated_at: "2026-03-10T00:00:00Z",
          },
        ],
        next_cursor: "cursor_2",
      },
    },
  };

  for (const [relativePath, value] of Object.entries(connectorFiles)) {
    const filePath = path.join(connectorRoot, relativePath);
    if (relativePath.endsWith(".md")) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, value);
      continue;
    }

    if (relativePath.endsWith(".yaml")) {
      writeYaml(filePath, value);
      continue;
    }

    writeJson(filePath, value);
  }

  if (mutateValidConnector) {
    mutateValidConnector({ tempRoot, connectorRoot, writeJson, writeYaml });
  }

  return tempRoot;
};

const runValidator = (root) =>
  spawnSync("node", [validatorScript, "--root", root], {
    encoding: "utf8",
  });

const assertPathExists = (targetPath, context) => {
  assert.equal(fs.existsSync(targetPath), true, `${context} should exist.`);
};

const assertFileContains = (targetPath, expectedText, context) => {
  const content = fs.readFileSync(targetPath, "utf8");
  assert.match(content, new RegExp(expectedText), `${context} should mention ${expectedText}.`);
};

const readYaml = (targetPath) => yaml.load(fs.readFileSync(targetPath, "utf8"));

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

const validRoot = buildFixtureRepo();
assertSuccess(runValidator(validRoot), "valid connector fixture");

const missingFieldRoot = buildFixtureRepo({
  mutateValidConnector: ({ connectorRoot, writeYaml }) => {
    writeYaml(path.join(connectorRoot, "manifest.yaml"), {
      slug: "demo-provider",
      description: "Missing required name field.",
      documentationUrl: "https://example.com/docs",
      deliveryModes: ["webhook", "polling"],
      auth: "oauth2",
      files: {
        auth: "auth.yaml",
        webhook: "webhook.yaml",
        polling: "polling.yaml",
        mapping: "mapping.yaml",
      },
    });
  },
});
assertFailure(runValidator(missingFieldRoot), "manifest.yaml", "missing required field fixture");

const secretLeakRoot = buildFixtureRepo({
  mutateValidConnector: ({ connectorRoot, writeYaml }) => {
    writeYaml(path.join(connectorRoot, "auth.yaml"), {
      strategy: "oauth2",
      oauth2: {
        authorizationUrl: "https://example.com/oauth/authorize",
        tokenUrl: "https://example.com/oauth/token",
        scopes: ["events.read"],
        clientIdEnvVar: "SP1_EXAMPLE_CLIENT_ID",
        clientSecretEnvVar: "sk_live_1234567890",
      },
    });
  },
});
assertFailure(runValidator(secretLeakRoot), "secret", "secret-like value fixture");

const templateRequiredFiles = [
  "manifest.yaml",
  "auth.yaml",
  "webhook.yaml",
  "polling.yaml",
  "mapping.yaml",
  "README.md",
  "fixtures/webhook-event.json",
  "fixtures/polling-page.json",
];

for (const relativePath of templateRequiredFiles) {
  assertPathExists(path.join(templateRoot, relativePath), `template file ${relativePath}`);
}

assertFileContains(
  path.join(templateRoot, "README.md"),
  "replace",
  "template README",
);

for (const placeholderFile of ["manifest.yaml", "auth.yaml", "fixtures/webhook-event.json"]) {
  assertFileContains(
    path.join(templateRoot, placeholderFile),
    "example|placeholder|redacted",
    `template placeholder file ${placeholderFile}`,
  );
}

const templateValidationRoot = fs.mkdtempSync(path.join(os.tmpdir(), "marketplace-template-"));
for (const directory of ["connectors", "schemas", "docs", "templates", "scripts"]) {
  fs.mkdirSync(path.join(templateValidationRoot, directory), { recursive: true });
}
fs.cpSync(templateRoot, path.join(templateValidationRoot, "connectors", "template-provider"), {
  recursive: true,
});
assertSuccess(runValidator(templateValidationRoot), "template connector fixture");

const resendRequiredFiles = [
  "manifest.yaml",
  "auth.yaml",
  "webhook.yaml",
  "polling.yaml",
  "mapping.yaml",
  "README.md",
  "fixtures/webhook-event.json",
  "fixtures/polling-page.json",
];

for (const relativePath of resendRequiredFiles) {
  assertPathExists(path.join(resendRoot, relativePath), `resend sample file ${relativePath}`);
}

assertSuccess(runValidator(smokeRoot), "resend sample connector");

const resendManifest = readYaml(path.join(resendRoot, "manifest.yaml"));
assert.deepEqual(
  resendManifest.deliveryModes,
  ["webhook", "polling"],
  "resend sample should represent both webhook and polling delivery modes.",
);

const resendAuth = readYaml(path.join(resendRoot, "auth.yaml"));
assert.equal(Array.isArray(resendAuth.install?.fields), true, "resend sample should include install config fields.");
assert.ok(resendAuth.install.fields.length >= 2, "resend sample should include multiple install config fields.");

for (const sanitizedFixture of [
  path.join(resendRoot, "fixtures", "webhook-event.json"),
  path.join(resendRoot, "fixtures", "polling-page.json"),
]) {
  assertFileContains(
    sanitizedFixture,
    "example|redacted|demo",
    `sanitized resend fixture ${path.basename(sanitizedFixture)}`,
  );
}

console.log("PASS");
