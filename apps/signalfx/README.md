# SignalFx

Receives detector alert notifications from Splunk Observability Cloud (SignalFx) via webhook integration.

## Setup

In Splunk Observability Cloud go to **Alerts → Detectors**, open a detector, and add a **Webhook** integration pointing to your StatuspageOne installation URL.

Configure the notification body to include `"type": "signalfx.detector.open"` when `sf_anomalyState` is `"Anomalous"` and `"type": "signalfx.detector.resolved"` when `sf_anomalyState` is `"Ok"`.

See [SignalFx webhook docs](https://help.splunk.com/en/splunk-observability-cloud/create-alerts-detectors-and-service-level-objectives/alerts-and-detectors/create-detectors-to-trigger-alerts) for payload configuration.
