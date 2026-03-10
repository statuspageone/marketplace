# Security And Redaction

Do not include secrets or real customer data.

## Prohibited Content

- API keys, OAuth client secrets, bearer tokens, passwords, signing secrets, and cookies
- Real webhook payloads that contain customer identifiers, email addresses, phone numbers, or billing details
- Internal URLs, private infrastructure names, or tenant-specific identifiers

## Required Redaction Practices

- Use obvious placeholders such as `sp1-example-client-id` and `sp1-redacted-signing-secret`.
- Replace personal data with generic values that cannot identify a user.
- Keep fixtures minimal and focused on schema shape rather than production volume.
- Document required environment variables by name only.
