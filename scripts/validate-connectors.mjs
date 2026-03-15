import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const scriptRoot = path.resolve(import.meta.dirname, "..");

const schemaFiles = {
  manifest: "connector-manifest.schema.json",
  auth: "connector-auth.schema.json",
  webhook: "connector-webhook.schema.json",
  polling: "connector-polling.schema.json",
  mapping: "connector-mapping.schema.json",
};

const fileNames = {
  manifest: "manifest.json",
  auth: "auth.json",
  webhook: "webhook.json",
  polling: "polling.json",
  mapping: "mapping.json",
};

const secretPattern =
  /(sk_live_|-----BEGIN|AKIA[0-9A-Z]{16}|xox[baprs]-|ghp_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]+|password|api[_-]?key|client[_-]?secret)/i;
const envVarPattern = /^[A-Z][A-Z0-9_]*$/;

const canonicalRoutePattern = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/;

const args = process.argv.slice(2);
let connectorRepoRoot = scriptRoot;

for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--root") {
    connectorRepoRoot = path.resolve(args[index + 1]);
    index += 1;
  }
}

const readConfigFile = (filePath) => {
  const content = fs.readFileSync(filePath, "utf8");

  // Support both YAML and JSON for backward compatibility during migration
  if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) {
    return yaml.load(content, {
      schema: yaml.SAFE_SCHEMA, // Security: disable custom types
      json: true, // Use JSON-compatible types only
    });
  }

  // Legacy JSON support
  return JSON.parse(content);
};

const loadSchemas = () =>
  Object.fromEntries(
    Object.entries(schemaFiles).map(([key, fileName]) => [
      key,
      readConfigFile(path.join(scriptRoot, "schemas", fileName)),
    ]),
  );

const validateAgainstSchema = (schema, value, pointer, failures) => {
  if (schema.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      failures.push(`${pointer} must be an object`);
      return;
    }

    for (const requiredKey of schema.required ?? []) {
      if (!(requiredKey in value)) {
        failures.push(`${pointer} is missing required field ${requiredKey}`);
      }
    }

    for (const [propertyName, propertySchema] of Object.entries(schema.properties ?? {})) {
      if (propertyName in value) {
        validateAgainstSchema(propertySchema, value[propertyName], `${pointer}.${propertyName}`, failures);
      }
    }
    return;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      failures.push(`${pointer} must be an array`);
      return;
    }

    if (schema.minItems && value.length < schema.minItems) {
      failures.push(`${pointer} must contain at least ${schema.minItems} item(s)`);
    }

    value.forEach((item, itemIndex) => {
      validateAgainstSchema(schema.items, item, `${pointer}[${itemIndex}]`, failures);
    });
    return;
  }

  if (schema.type === "string") {
    if (typeof value !== "string") {
      failures.push(`${pointer} must be a string`);
      return;
    }

    if (schema.enum && !schema.enum.includes(value)) {
      failures.push(`${pointer} must be one of: ${schema.enum.join(", ")}`);
    }
  }
};

const walkStrings = (value, visit, propertyName = "") => {
  if (typeof value === "string") {
    visit(value, propertyName);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => walkStrings(item, visit, propertyName));
    return;
  }

  if (typeof value === "object" && value !== null) {
    for (const [nestedKey, item] of Object.entries(value)) {
      walkStrings(item, visit, nestedKey);
    }
  }
};

const collectConnectorDirectories = (root) => {
  const connectorsRoot = path.join(root, "connectors");
  if (!fs.existsSync(connectorsRoot)) {
    return [];
  }

  return fs
    .readdirSync(connectorsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(connectorsRoot, entry.name));
};

const validateConnector = (connectorPath, schemas) => {
  const failures = [];
  const parsedFiles = {};

  for (const [key, fileName] of Object.entries(fileNames)) {
    const fullPath = path.join(connectorPath, fileName);
    if (!fs.existsSync(fullPath)) {
      failures.push(`${path.basename(connectorPath)} is missing ${fileName}`);
      continue;
    }

    try {
      parsedFiles[key] = readConfigFile(fullPath);
      validateAgainstSchema(schemas[key], parsedFiles[key], fileName, failures);
    } catch (error) {
      failures.push(`${fileName} could not be parsed: ${error.message}`);
    }
  }

  const readmePath = path.join(connectorPath, "README.md");
  if (!fs.existsSync(readmePath)) {
    failures.push(`${path.basename(connectorPath)} is missing README.md`);
  }

  const manifestFiles = parsedFiles.manifest?.files ?? {};
  for (const manifestFileKey of ["auth", "webhook", "polling", "mapping"]) {
    if (manifestFiles[manifestFileKey] && manifestFiles[manifestFileKey] !== fileNames[manifestFileKey]) {
      failures.push(`manifest.json files.${manifestFileKey} must reference ${fileNames[manifestFileKey]}`);
    }
  }

  for (const fixturePath of [parsedFiles.webhook?.fixturePath, parsedFiles.polling?.fixturePath]) {
    if (!fixturePath) {
      continue;
    }

    const fullFixturePath = path.join(connectorPath, fixturePath);
    if (!fs.existsSync(fullFixturePath)) {
      failures.push(`Missing fixture ${fixturePath}`);
    }
  }

  const routes = parsedFiles.mapping?.routes ?? [];
  if (routes.length === 0) {
    failures.push("mapping.json must define at least one canonical route");
  }

  routes.forEach((route, routeIndex) => {
    if (!canonicalRoutePattern.test(route.canonicalRoute ?? "")) {
      failures.push(`mapping.json routes[${routeIndex}].canonicalRoute must use dot-separated canonical form`);
    }
  });

  for (const [fileName, fileValue] of Object.entries(parsedFiles)) {
    walkStrings(fileValue, (stringValue, propertyName) => {
      if (propertyName.toLowerCase().includes("envvar") && envVarPattern.test(stringValue)) {
        return;
      }
      // Allow auth enum value "apiKey" (connector type, not a secret)
      if (
        (fileName === "manifest" && propertyName === "auth") ||
        (fileName === "auth" && propertyName === "strategy")
      ) {
        if (stringValue === "apiKey") return;
      }

      if (secretPattern.test(stringValue) && !envVarPattern.test(stringValue)) {
        failures.push(`${fileNames[fileName]} contains a secret-like value`);
      }
    });
  }

  return failures;
};

const schemas = loadSchemas();
const connectorDirectories = collectConnectorDirectories(connectorRepoRoot);
const failures = [];

for (const connectorPath of connectorDirectories) {
  for (const failure of validateConnector(connectorPath, schemas)) {
    failures.push(`${path.basename(connectorPath)}: ${failure}`);
  }
}

if (failures.length > 0) {
  console.error("FAIL");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`PASS (${connectorDirectories.length} connector${connectorDirectories.length === 1 ? "" : "s"})`);
