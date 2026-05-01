# Axiom

Receives monitor alert notifications from Axiom via webhook notifier.

## Setup

In Axiom go to **Monitors**, open a monitor, and add a **Webhook** notifier pointing to your StatuspageOne installation URL.

Axiom sends a JSON payload with a top-level `event` object containing monitor details, matched dimensions, and a `sourceURL` for the alert. The `type` field is set automatically by Axiom: `monitor.open` when the monitor fires and `monitor.resolved` when it recovers.

No custom template configuration is required.
