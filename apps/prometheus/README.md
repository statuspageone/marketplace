# Prometheus

Receives alert notifications from Prometheus Alertmanager via webhook receiver.

## Setup

Add a webhook receiver to your Alertmanager config and use a custom template to include the `type` routing field.

**`alertmanager.yml`:**
```yaml
receivers:
  - name: statuspageone
    webhook_configs:
      - url: '<your-installation-webhook-url>'
        send_resolved: true
```

**`templates/statuspageone.tmpl`:**
```
{{ define "statuspageone.json" -}}
{
  "type": "prometheus.alert.{{ if eq .Status "firing" }}firing{{ else }}resolved{{ end }}",
  "receiver": "{{ .Receiver }}",
  "status": "{{ .Status }}",
  "alerts": {{ .Alerts | toJson }},
  "groupLabels": {{ .GroupLabels | toJson }},
  "commonLabels": {{ .CommonLabels | toJson }},
  "commonAnnotations": {{ .CommonAnnotations | toJson }},
  "externalURL": "{{ .ExternalURL }}",
  "version": "4",
  "groupKey": "{{ .GroupKey }}"
}
{{- end }}
```

Reference the template in `alertmanager.yml`:
```yaml
templates:
  - '/etc/alertmanager/templates/*.tmpl'
```
