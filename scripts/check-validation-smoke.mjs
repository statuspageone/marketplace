import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const smokeRoot = path.resolve(import.meta.dirname, "..");
const validatorScript = path.join(smokeRoot, "scripts", "validate-connectors.mjs");

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const buildFixtureRepo = ({ mutateValidConnector } = {}) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "marketplace-smoke-"));
  const directories = ["connectors", "schemas", "docs", "templates", "scripts"];

  for (const directory of directories) {
    fs.mkdirSync(path.join(tempRoot, directory), { recursive: true });
  }

  const connectorRoot = path.join(tempRoot, "connectors", "demo-provider");
  const fixturesRoot = path.join(connectorRoot, "fixtures");

  const connectorFiles = {
    "manifest.json": {
      slug: "demo-provider",
      name: "Demo Provider",
      description: "Sanitized example connector for validation smoke tests.",
      documentationUrl: "https://example.com/docs",
      deliveryModes: ["webhook", "polling"],
      auth: "oauth2",
      files: {
        auth: "auth.json",
        webhook: "webhook.json",
        polling: "polling.json",
        mapping: "mapping.json",
      },
    },
    "auth.json": {
      strategy: "oauth2",
      oauth2: {
        authorizationUrl: "https://example.com/oauth/authorize",
        tokenUrl: "https://example.com/oauth/token",
        scopes: ["events.read"],
        clientIdEnvVar: "SP1_EXAMPLE_CLIENT_ID",
        clientSecretEnvVar: "SP1_EXAMPLE_CLIENT_SECRET",
      },
    },
    "webhook.json": {
      subscriptionUrl: "https://api.example.com/webhooks",
      signatureHeader: "x-demo-signature",
      events: ["incident.created"],
      fixturePath: "fixtures/webhook-event.json",
    },
    "polling.json": {
      endpoint: "https://api.example.com/incidents",
      itemsPath: "data.items",
      cursorField: "updated_at",
      pagination: {
        type: "cursor",
        nextCursorPath: "data.next_cursor",
      },
      fixturePath: "fixtures/polling-page.json",
    },
    "mapping.json": {
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

    writeJson(filePath, value);
  }

  if (mutateValidConnector) {
    mutateValidConnector({ tempRoot, connectorRoot, writeJson });
  }

  return tempRoot;
};

const runValidator = (root) =>
  spawnSync("node", [validatorScript, "--root", root], {
    encoding: "utf8",
  });

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
  mutateValidConnector: ({ connectorRoot, writeJson }) => {
    writeJson(path.join(connectorRoot, "manifest.json"), {
      slug: "demo-provider",
      description: "Missing required name field.",
      documentationUrl: "https://example.com/docs",
      deliveryModes: ["webhook", "polling"],
      auth: "oauth2",
      files: {
        auth: "auth.json",
        webhook: "webhook.json",
        polling: "polling.json",
        mapping: "mapping.json",
      },
    });
  },
});
assertFailure(runValidator(missingFieldRoot), "manifest.json", "missing required field fixture");

const secretLeakRoot = buildFixtureRepo({
  mutateValidConnector: ({ connectorRoot, writeJson }) => {
    writeJson(path.join(connectorRoot, "auth.json"), {
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

console.log("PASS");
