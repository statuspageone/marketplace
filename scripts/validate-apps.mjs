import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const scriptRoot = path.resolve(import.meta.dirname, "..");

const SOURCE_SCHEMA_FILES = {
  base: "base-manifest.schema.json",
  manifest: "source-manifest.schema.json",
  auth: "source-auth.schema.json",
  webhook: "source-webhook.schema.json",
  polling: "source-polling.schema.json",
  mapping: "source-mapping.schema.json",
};

const DESTINATION_SCHEMA_FILES = {
  base: "base-manifest.schema.json",
  manifest: "destination-manifest.schema.json",
  auth: "destination-auth.schema.json",
  delivery: "destination-delivery.schema.json",
};

const SOURCE_FILE_NAMES = {
  manifest: "manifest.yaml",
  auth: "auth.yaml",
  webhook: "webhook.yaml",
  polling: "polling.yaml",
  mapping: "mapping.yaml",
};

const SECRET_PATTERN =
  /(sk_live_|-----BEGIN|AKIA[0-9A-Z]{16}|xox[baprs]-|ghp_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]+|password|api[_-]?key|client[_-]?secret)/i;
const ENV_VAR_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const CANONICAL_ROUTE_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/;

const args = process.argv.slice(2);
let appRepoRoot = scriptRoot;

for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--root") {
    appRepoRoot = path.resolve(args[index + 1]);
    index += 1;
  }
}

const readConfigFile = (filePath) => {
  const content = fs.readFileSync(filePath, "utf8");
  return yaml.load(content, { schema: yaml.SAFE_SCHEMA, json: true });
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
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      failures.push(`${pointer} must match pattern ${schema.pattern}`);
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
      if (
        (fileKey === "manifest" && propertyName === "auth") ||
        (fileKey === "auth" && propertyName === "strategy")
      ) {
        if (stringValue === "apiKey") return;
      }
      if (SECRET_PATTERN.test(stringValue) && !ENV_VAR_PATTERN.test(stringValue)) {
        failures.push(`${fileKey}.yaml contains a secret-like value`);
      }
    });
  }
};

const collectAppDirectories = (root, type) => {
  const appsRoot = path.join(root, `${type}s`);
  if (!fs.existsSync(appsRoot)) return [];
  return fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(appsRoot, entry.name));
};

const validateSource = (appPath) => {
  const failures = [];
  const parsedFiles = {};
  const appName = path.basename(appPath);

  for (const [key, fileName] of Object.entries(SOURCE_FILE_NAMES)) {
    const fullPath = path.join(appPath, fileName);
    if (!fs.existsSync(fullPath)) {
      failures.push(`${appName} is missing ${fileName}`);
      continue;
    }
    try {
      parsedFiles[key] = readConfigFile(fullPath);
    } catch (error) {
      failures.push(`${fileName} could not be parsed: ${error.message}`);
    }
  }

  if (!fs.existsSync(path.join(appPath, "README.md"))) {
    failures.push(`${appName} is missing README.md`);
  }

  if (!parsedFiles.manifest) return failures;

  // Pass 1: base schema
  validateAgainstSchema(loadSchema(SOURCE_SCHEMA_FILES.base), parsedFiles.manifest, "manifest.yaml", failures);

  // Consistency guard — must be in sources/ and declare app_type: source
  if (!parsedFiles.manifest.app_type || parsedFiles.manifest.app_type !== "source") {
    failures.push(`manifest.yaml app_type must be "source" for apps in sources/ (got: "${parsedFiles.manifest.app_type ?? "undefined"}")`);
  }

  // Pass 2: source-specific schema
  validateAgainstSchema(loadSchema(SOURCE_SCHEMA_FILES.manifest), parsedFiles.manifest, "manifest.yaml", failures);

  if (parsedFiles.auth) validateAgainstSchema(loadSchema(SOURCE_SCHEMA_FILES.auth), parsedFiles.auth, "auth.yaml", failures);
  if (parsedFiles.webhook) validateAgainstSchema(loadSchema(SOURCE_SCHEMA_FILES.webhook), parsedFiles.webhook, "webhook.yaml", failures);
  if (parsedFiles.polling) validateAgainstSchema(loadSchema(SOURCE_SCHEMA_FILES.polling), parsedFiles.polling, "polling.yaml", failures);
  if (parsedFiles.mapping) validateAgainstSchema(loadSchema(SOURCE_SCHEMA_FILES.mapping), parsedFiles.mapping, "mapping.yaml", failures);

  for (const fixturePath of [parsedFiles.webhook?.fixturePath, parsedFiles.polling?.fixturePath]) {
    if (!fixturePath) continue;
    if (!fs.existsSync(path.join(appPath, fixturePath))) {
      failures.push(`Missing fixture ${fixturePath}`);
    }
  }

  const routes = parsedFiles.mapping?.routes ?? [];
  if (routes.length === 0) {
    failures.push(`mapping.yaml must define at least one canonical route`);
  }
  routes.forEach((route, idx) => {
    if (!CANONICAL_ROUTE_PATTERN.test(route.canonicalRoute ?? "")) {
      failures.push(`mapping.yaml routes[${idx}].canonicalRoute must use dot-separated canonical form`);
    }
  });

  checkSecrets(parsedFiles, failures);
  return failures;
};

const validateDestination = (appPath) => {
  const failures = [];
  const parsedFiles = {};
  const appName = path.basename(appPath);

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

  if (!fs.existsSync(path.join(appPath, "README.md"))) {
    failures.push(`${appName} is missing README.md`);
  }

  // Pass 1: base schema
  validateAgainstSchema(loadSchema(DESTINATION_SCHEMA_FILES.base), parsedFiles.manifest, "manifest.yaml", failures);

  // Consistency guard
  if (!parsedFiles.manifest.app_type || parsedFiles.manifest.app_type !== "destination") {
    failures.push(`manifest.yaml app_type must be "destination" for apps in destinations/ (got: "${parsedFiles.manifest.app_type ?? "undefined"}")`);
  }

  // Pass 2: destination-specific schema
  validateAgainstSchema(loadSchema(DESTINATION_SCHEMA_FILES.manifest), parsedFiles.manifest, "manifest.yaml", failures);

  // Auth file
  const authPath = path.join(appPath, "auth.yaml");
  if (!fs.existsSync(authPath)) {
    failures.push(`${appName} is missing auth.yaml`);
  } else {
    try {
      parsedFiles.auth = readConfigFile(authPath);
      validateAgainstSchema(loadSchema(DESTINATION_SCHEMA_FILES.auth), parsedFiles.auth, "auth.yaml", failures);
    } catch (error) {
      failures.push(`auth.yaml: ${error.message}`);
    }
  }

  // Destinations file
  const destinationsFileName = parsedFiles.manifest?.files?.destinations ?? "destinations.yaml";
  const destinationsPath = path.join(appPath, destinationsFileName);
  if (!fs.existsSync(destinationsPath)) {
    failures.push(`${appName} is missing ${destinationsFileName}`);
  } else {
    try {
      parsedFiles.destinations = readConfigFile(destinationsPath);
      if (!Array.isArray(parsedFiles.destinations?.destinations)) {
        failures.push(`${destinationsFileName} must define a top-level "destinations" array`);
      }
    } catch (error) {
      failures.push(`${destinationsFileName} could not be parsed: ${error.message}`);
    }
  }

  // Delivery file (free-form name — referenced by manifest.files.delivery)
  const deliveryFileName = parsedFiles.manifest?.files?.delivery;
  if (!deliveryFileName) {
    failures.push(`manifest.yaml files.delivery is required`);
  } else {
    const deliveryPath = path.join(appPath, deliveryFileName);
    if (!fs.existsSync(deliveryPath)) {
      failures.push(`${appName} is missing ${deliveryFileName} (referenced by manifest.yaml files.delivery)`);
    } else {
      try {
        parsedFiles.delivery = readConfigFile(deliveryPath);
        validateAgainstSchema(loadSchema(DESTINATION_SCHEMA_FILES.delivery), parsedFiles.delivery, deliveryFileName, failures);
      } catch (error) {
        failures.push(`${deliveryFileName}: ${error.message}`);
      }
    }
  }

  checkSecrets(parsedFiles, failures);
  return failures;
};

const sourceDirectories = collectAppDirectories(appRepoRoot, "source");
const destinationDirectories = collectAppDirectories(appRepoRoot, "destination");
const failures = [];
let totalApps = 0;

for (const appPath of sourceDirectories) {
  totalApps += 1;
  for (const failure of validateSource(appPath)) {
    failures.push(`${path.basename(appPath)}: ${failure}`);
  }
}

for (const appPath of destinationDirectories) {
  totalApps += 1;
  for (const failure of validateDestination(appPath)) {
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
