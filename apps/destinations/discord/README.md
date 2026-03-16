# Discord Destination

Send monitor alerts to Discord channels via webhooks.

## Setup Guide

### 1. Create Discord Webhook

1. Open Discord and navigate to your server
2. Click **Server Settings** → **Integrations**
3. Click **Webhooks** → **New Webhook**
4. Configure the webhook:
   - **Name**: StatusPageOne Alerts (or your choice)
   - **Channel**: Select the channel for alerts (e.g., #monitoring, #alerts)
5. Click **Copy Webhook URL**

### 2. Install in StatusPageOne

1. Navigate to **Marketplace** → **Destinations**
2. Click the **Discord** card
3. Click **Install**
4. Paste your webhook URL from step 1.5
5. Click **Test Connection** to verify
6. Click **Finish Installation**

### 3. Create Destination Configuration

1. On the installation detail page, click **Create Destination Config**
2. Configure:
   - **Name**: Critical Alerts (or your choice)
   - **Message Template**: Customize the message format
     - Example: `🚨 **{{monitor.name}}** is {{event.status}}`
   - **Enable on all monitors**: Check to auto-enable (recommended)
3. Click **Create**

## Template Variables

**Event:**
- `{{event.status}}` - Current status (up, down, degraded)
- `{{event.previous_status}}` - Previous status
- `{{event.timestamp}}` - Event timestamp (ISO 8601)
- `{{event.is_down}}` - Boolean: is monitor down?
- `{{event.is_up}}` - Boolean: is monitor up?

**Monitor:**
- `{{monitor.name}}` - Monitor name
- `{{monitor.url}}` - Monitored URL
- `{{monitor.type}}` - Monitor type (http, tcp, etc.)
- `{{monitor.region}}` - Check region

**Organization:**
- `{{organization.name}}` - Your organization name

## Example Templates

### Minimal
```
{{monitor.name}} is {{event.status}}
```

### With Emoji
```
{{#if event.is_down}}🔴{{else if event.is_degraded}}🟡{{else}}🟢{{/if}} **{{monitor.name}}** is {{uppercase event.status}}
```

### Detailed
```
🚨 Alert: **{{monitor.name}}** changed from {{event.previous_status}} to {{event.status}}
URL: {{monitor.url}}
Region: {{monitor.region}}
Time: {{event.timestamp}}
```

## Troubleshooting

**Message not appearing in Discord:**
- Verify webhook URL is correct
- Check Discord channel permissions
- Verify destination config is enabled

**Invalid webhook URL error:**
- URL must start with `https://discord.com/api/webhooks/`
- Format: `https://discord.com/api/webhooks/[ID]/[TOKEN]`
