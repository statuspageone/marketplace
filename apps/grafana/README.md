# Grafana

Receives alert notifications from Grafana Alerting via webhook contact point.

## Setup

In Grafana go to **Alerting → Contact points** and add a Webhook contact point pointing to your StatuspageOne installation URL.

Under **Optional settings → Custom payload**, use this Go template so Grafana includes the `type` routing field:

```
{{ define "statuspageone.webhook" -}}
{
  "type": "grafana.alert.{{ if eq .Status "firing" }}firing{{ else }}resolved{{ end }}",
  "receiver": "{{ .Receiver }}",
  "status": "{{ .Status }}",
  "orgId": {{ .OrgID }},
  "commonLabels": {{ .CommonLabels | toJson }},
  "commonAnnotations": {{ .CommonAnnotations | toJson }},
  "alerts": {{ .Alerts | toJson }},
  "externalURL": "{{ .ExternalURL }}",
  "groupKey": "{{ .GroupKey }}"
}
{{- end }}
```

Set the contact point **Message** to: `{{ template "statuspageone.webhook" . }}`
