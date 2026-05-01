# Amazon CloudWatch

Receives alarm state change notifications from Amazon CloudWatch via SNS HTTP subscription.

## Setup

1. In AWS create an SNS topic and subscribe it to your StatuspageOne installation URL (HTTPS).
2. In CloudWatch open your alarm and set the SNS topic as the notification target for **In alarm** and **OK** states.

### SNS payload handling

CloudWatch delivers alarm data inside an SNS envelope where the actual alarm JSON is a string in the `Message` field. The platform expects the pre-parsed alarm body, not the outer SNS envelope. Configure an intermediary (e.g. AWS Lambda) to extract and forward the `Message` content if needed.

The `type` routing field must be set based on `NewStateValue`: `"ALARM"` → `"cloudwatch.alarm.open"`, `"OK"` → `"cloudwatch.alarm.resolved"`.
