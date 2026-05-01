import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const scriptRoot = path.resolve(import.meta.dirname, "..");

const SCHEMA_FILES = {
  baseManifest: "base-manifest.schema.json",
  auth: "auth.schema.json",
  sourceWebhook: "source-webhook.schema.json",
  sourcePolling: "source-polling.schema.json",
  sourceMapping: "source-mapping.schema.json",
  destinationDelivery: "destination-delivery.schema.json",
};

const KNOWN_CAPABILITIES = new Set(["source", "destination"]);

const SECRET_PATTERN =
  /(sk_live_|-----BEGIN|AKIA[0-9A-Z]{16}|xox[baprs]-|ghp_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]+|password|api[_-]?key|client[_-]?secret)/i;
const ENV_VAR_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const REQUIRED_SOURCE_MAPPING_FIELDS = ["provider", "provider_event_type", "status", "severity", "title", "occurred_at"];
const OPTIONAL_SOURCE_MAPPING_FIELDS = [
  "description",
  "resource_type",
  "resource_id",
  "resource_name",
  "service_name",
  "environment",
  "source_url",
];
const SOURCE_MAPPING_FIELDS = new Set([
  ...REQUIRED_SOURCE_MAPPING_FIELDS,
  ...OPTIONAL_SOURCE_MAPPING_FIELDS,
]);
const STATUS_LITERALS = new Set(["open", "acknowledged", "resolved"]);
const SEVERITY_LITERALS = new Set(["critical", "high", "medium", "low", "info"]);

const args = process.argv.slice(2);
let appRepoRoot = scriptRoot;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--root") {
    appRepoRoot = path.resolve(args[i + 1]);
    i++;
  }
}

const readConfigFile = (filePath) => {
  const content = fs.readFileSync(filePath, "utf8");
  return yaml.load(content, { schema: yaml.SAFE_SCHEMA, json: true });
};

const isValidHttpsUrl = (value) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const loadSchema = (schemaFileName) => {
  const schemaPath = path.join(scriptRoot, "schemas", schemaFileName);
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: schemas/${schemaFileName}`);
  }
  return readConfigFile(schemaPath);
};

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
    value.forEach((item, idx) => {
      validateAgainstSchema(schema.items, item, `${pointer}[${idx}]`, failures);
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
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      failures.push(`${pointer} must match pattern ${schema.pattern}`);
    }
  }
  if (schema.type === "integer") {
    if (!Number.isInteger(value)) {
      failures.push(`${pointer} must be an integer`);
      return;
    }
    if (schema.minimum !== undefined && value < schema.minimum) {
      failures.push(`${pointer} must be at least ${schema.minimum}`);
    }
  }
  if (schema.type === "boolean") {
    if (typeof value !== "boolean") {
      failures.push(`${pointer} must be a boolean`);
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

const checkSecrets = (parsedFiles, failures) => {
  for (const [fileKey, fileValue] of Object.entries(parsedFiles)) {
    walkStrings(fileValue, (stringValue, propertyName) => {
      if (propertyName.toLowerCase().includes("envvar") && ENV_VAR_PATTERN.test(stringValue)) return;
      if (fileKey === "auth" && propertyName === "strategy") return;
      if (SECRET_PATTERN.test(stringValue) && !ENV_VAR_PATTERN.test(stringValue)) {
        failures.push(`${fileKey} contains a secret-like value`);
      }
    });
  }
};

const collectApps = (root) => {
  const appsRoot = path.join(root, "apps");
  if (!fs.existsSync(appsRoot)) return [];
  return fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(appsRoot, entry.name));
};

const validateApp = (appPath) => {
  const failures = [];
  const appName = path.basename(appPath);
  const parsedFiles = {};

  // README
  if (!fs.existsSync(path.join(appPath, "README.md"))) {
    failures.push(`${appName} is missing README.md`);
  }

  // manifest.yaml
  const manifestPath = path.join(appPath, "manifest.yaml");
  if (!fs.existsSync(manifestPath)) {
    failures.push(`${appName} is missing manifest.yaml`);
    return failures;
  }
  try {
    parsedFiles.manifest = readConfigFile(manifestPath);
  } catch (error) {
    failures.push(`manifest.yaml could not be parsed: ${error.message}`);
    return failures;
  }
  validateAgainstSchema(loadSchema(SCHEMA_FILES.baseManifest), parsedFiles.manifest, "manifest.yaml", failures);
  if (!isValidHttpsUrl(parsedFiles.manifest?.icon)) {
    failures.push(`manifest.yaml icon must be a valid https URL`);
  }

  // auth.yaml — always required
  const authPath = path.join(appPath, "auth.yaml");
  if (!fs.existsSync(authPath)) {
    failures.push(`${appName} is missing auth.yaml`);
  } else {
    try {
      parsedFiles.auth = readConfigFile(authPath);
      validateAgainstSchema(loadSchema(SCHEMA_FILES.auth), parsedFiles.auth, "auth.yaml", failures);
    } catch (error) {
      failures.push(`auth.yaml could not be parsed: ${error.message}`);
    }
  }

  const capabilities = Array.isArray(parsedFiles.manifest?.capabilities)
    ? parsedFiles.manifest.capabilities
    : [];

  // Unknown capability check
  for (const cap of capabilities) {
    if (!KNOWN_CAPABILITIES.has(cap)) {
      failures.push(`manifest.yaml capabilities contains unknown value "${cap}" (allowed: source, destination)`);
    }
  }

  // Strategy-capability compatibility
  if (parsedFiles.auth?.strategy === "webhook_url" && !capabilities.includes("destination")) {
    failures.push(`auth.yaml strategy "webhook_url" is only valid for apps with "destination" capability`);
  }

  // Capability presence + orphan checks (app root only)
  for (const cap of ["source", "destination"]) {
    const capDirPath = path.join(appPath, cap);
    const capDeclared = capabilities.includes(cap);
    const capDirExists = fs.existsSync(capDirPath) && fs.statSync(capDirPath).isDirectory();
    if (capDeclared && !capDirExists) {
      failures.push(`manifest.yaml declares capability "${cap}" but ${cap}/ directory is missing`);
    }
    if (!capDeclared && capDirExists) {
      failures.push(`${cap}/ directory exists but "${cap}" is not listed in manifest.yaml capabilities`);
    }
  }

  // source/ validation
  if (capabilities.includes("source")) {
    const sourcePath = path.join(appPath, "source");
    const hasWebhook = fs.existsSync(path.join(sourcePath, "webhook.yaml"));
    const hasPolling = fs.existsSync(path.join(sourcePath, "polling.yaml"));

    if (!hasWebhook && !hasPolling) {
      failures.push(`source/ must contain at least one of webhook.yaml or polling.yaml`);
    }

    if (hasWebhook) {
      try {
        parsedFiles.sourceWebhook = readConfigFile(path.join(sourcePath, "webhook.yaml"));
        validateAgainstSchema(
          loadSchema(SCHEMA_FILES.sourceWebhook),
          parsedFiles.sourceWebhook,
          "source/webhook.yaml",
          failures,
        );
        const fixturePath = parsedFiles.sourceWebhook?.fixturePath;
        if (fixturePath && !fs.existsSync(path.join(sourcePath, fixturePath))) {
          failures.push(`source/webhook.yaml: missing fixture ${fixturePath}`);
        }
      } catch (error) {
        failures.push(`source/webhook.yaml could not be parsed: ${error.message}`);
      }
    }

    if (hasPolling) {
      try {
        parsedFiles.sourcePolling = readConfigFile(path.join(sourcePath, "polling.yaml"));
        validateAgainstSchema(
          loadSchema(SCHEMA_FILES.sourcePolling),
          parsedFiles.sourcePolling,
          "source/polling.yaml",
          failures,
        );
        const fixturePath = parsedFiles.sourcePolling?.fixturePath;
        if (fixturePath && !fs.existsSync(path.join(sourcePath, fixturePath))) {
          failures.push(`source/polling.yaml: missing fixture ${fixturePath}`);
        }
      } catch (error) {
        failures.push(`source/polling.yaml could not be parsed: ${error.message}`);
      }
    }

    const mappingPath = path.join(sourcePath, "mapping.yaml");
    if (!fs.existsSync(mappingPath)) {
      failures.push(`source/ is missing mapping.yaml`);
    } else {
      try {
        parsedFiles.sourceMapping = readConfigFile(mappingPath);
        validateAgainstSchema(
          loadSchema(SCHEMA_FILES.sourceMapping),
          parsedFiles.sourceMapping,
          "source/mapping.yaml",
          failures,
        );
        const events = parsedFiles.sourceMapping?.events ?? [];
        events.forEach((eventMapping, idx) => {
          const fieldMappings = eventMapping?.fieldMappings ?? {};

          for (const fieldName of Object.keys(fieldMappings)) {
            if (!SOURCE_MAPPING_FIELDS.has(fieldName)) {
              failures.push(
                `source/mapping.yaml events[${idx}].fieldMappings contains unsupported field "${fieldName}"`,
              );
            }
          }

          for (const requiredField of REQUIRED_SOURCE_MAPPING_FIELDS) {
            if (!(requiredField in fieldMappings)) {
              failures.push(
                `source/mapping.yaml events[${idx}].fieldMappings is missing required field "${requiredField}"`,
              );
            }
          }

          if (!("resource_id" in fieldMappings) && !("resource_name" in fieldMappings)) {
            failures.push(
              `source/mapping.yaml events[${idx}].fieldMappings must define at least one of "resource_id" or "resource_name"`,
            );
          }

          const statusLiteral = fieldMappings?.status?.literal;
          if (statusLiteral && !STATUS_LITERALS.has(statusLiteral)) {
            failures.push(
              `source/mapping.yaml events[${idx}].fieldMappings.status.literal must be one of: ${Array.from(STATUS_LITERALS).join(", ")}`,
            );
          }

          const severityLiteral = fieldMappings?.severity?.literal;
          if (severityLiteral && !SEVERITY_LITERALS.has(severityLiteral)) {
            failures.push(
              `source/mapping.yaml events[${idx}].fieldMappings.severity.literal must be one of: ${Array.from(SEVERITY_LITERALS).join(", ")}`,
            );
          }
        });
      } catch (error) {
        failures.push(`source/mapping.yaml could not be parsed: ${error.message}`);
      }
    }
  }

  // destination/ validation
  if (capabilities.includes("destination")) {
    const destPath = path.join(appPath, "destination");
    let targetIds = [];

    const targetsPath = path.join(destPath, "targets.yaml");
    if (!fs.existsSync(targetsPath)) {
      failures.push(`destination/ is missing targets.yaml`);
    } else {
      try {
        parsedFiles.destinationTargets = readConfigFile(targetsPath);
        if (!Array.isArray(parsedFiles.destinationTargets?.targets)) {
          failures.push(`destination/targets.yaml must define a top-level "targets" array`);
        } else {
          targetIds = parsedFiles.destinationTargets.targets.map((t) => t.id).filter(Boolean);
        }
      } catch (error) {
        failures.push(`destination/targets.yaml could not be parsed: ${error.message}`);
      }
    }

    const deliveryPath = path.join(destPath, "webhook.yaml");
    if (!fs.existsSync(deliveryPath)) {
      failures.push(`destination/ is missing webhook.yaml`);
    } else {
      try {
        parsedFiles.destinationDelivery = readConfigFile(deliveryPath);
        validateAgainstSchema(
          loadSchema(SCHEMA_FILES.destinationDelivery),
          parsedFiles.destinationDelivery,
          "destination/webhook.yaml",
          failures,
        );
        const targetId = parsedFiles.destinationDelivery?.target_id;
        if (targetId && !targetIds.includes(targetId)) {
          failures.push(
            `destination/webhook.yaml target_id "${targetId}" not found in destination/targets.yaml`,
          );
        }
      } catch (error) {
        failures.push(`destination/webhook.yaml could not be parsed: ${error.message}`);
      }
    }

    if (!fs.existsSync(path.join(destPath, "fixtures", "test-message.json"))) {
      failures.push(`destination/fixtures/test-message.json is missing`);
    }
  }

  checkSecrets(parsedFiles, failures);
  return failures;
};

// Main
const appDirectories = collectApps(appRepoRoot);
const failures = [];
let totalApps = 0;

for (const appPath of appDirectories) {
  totalApps++;
  for (const failure of validateApp(appPath)) {
    failures.push(`${path.basename(appPath)}: ${failure}`);
  }
}

if (failures.length > 0) {
  console.error("FAIL");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`PASS (${totalApps} app${totalApps === 1 ? "" : "s"})`);
