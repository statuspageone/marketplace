# Review Checklist

- The connector folder contains the complete required file set and passes `pnpm validate`.
- Provider metadata is clear, public-safe, and matches the documented auth strategy.
- Webhook and polling definitions are internally consistent with the provider behavior being proposed.
- OAuth configuration uses placeholder values and environment variable names only.
- Route normalization is stable, canonical, and explained in the connector README.
- Fixtures are redacted, minimal, and free of secrets or customer data.
- No runtime code, private customer logic, or importer implementation details are present.
