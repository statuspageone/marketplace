# Review Checklist

- The connector folder contains the complete required file set and passes `pnpm validate`.
- Provider metadata is clear, public-safe, and matches the documented auth strategy.
- Webhook and polling definitions are internally consistent with the provider behavior being proposed.
- OAuth configuration uses placeholder values and environment variable names only.
- Route normalization is stable, canonical, and explained in the connector README.
- Fixtures are redacted, minimal, and free of secrets or customer data.
- No runtime code, private customer logic, or importer implementation details are present.
- The pull request template is fully completed, including the redaction confirmation.
- CI passes with `pnpm validate` without requiring private context or non-public dependencies.

## Destination Apps

- `manifest.yaml` has `app_type: destination`, `capabilities`, and `files` (auth, destinations, delivery).
- `auth.yaml` has valid `strategy` (`webhook_url`, `bearer`, or `none`).
- `destinations.yaml` defines a `destinations` array with at least one entry having an `id`.
- Delivery file exists and its `destination_id` matches a destinations entry.
- No real webhook URLs or tokens in fixtures.
- `pnpm validate` passes.
