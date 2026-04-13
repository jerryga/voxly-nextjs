# Voxly Workspace Settings: Delivery

This document explains the **Delivery** section inside Workspace Settings, including what it is for, what users can configure, and how it connects to workspace reports, project reports, Slack, email, and report history.

## Purpose

Delivery is the workspace-level control center for recurring reports.

It helps workspace owners and admins answer a practical question:

> What should Voxly send, when should it send it, and who should receive it?

The section exists so teams do not need to manually inspect every recording, task, or saved insight to stay aligned. Instead, Voxly can package recent workspace activity into scheduled reports and deliver them through email and optionally Slack.

## Where Users Find It

Delivery appears under:

```text
Workspace Settings -> Delivery
```

It is separate from **Personal Settings**. Personal Settings control one user's notification preferences across all workspaces. Delivery controls shared workspace reporting behavior for the active workspace.

## Who Can Use It

Owners and admins can manage Delivery settings.

They can:

- enable or pause recurring workspace reports
- choose cadence, report type, recipients, and delivery channels
- save the configuration
- send a workspace report immediately
- create and delete report templates

Members and viewers can see workspace context elsewhere in the app, but Delivery management is restricted to users who can manage the workspace.

## Main Features

### 1. Scheduled Workspace Report

The first part of Delivery configures one recurring report for the current workspace.

This report summarizes workspace-level activity, including:

- recent workspace insights
- recent project insights across the workspace
- open tasks and active follow-ups
- a link back to the workspace

The saved settings are stored in `WorkspaceDigestSettings`.

### 2. Digest Status

The recurring workspace report can be:

- **Enabled**: Voxly can send it automatically when it is due.
- **Paused**: settings remain saved, but scheduled delivery does not run.

Manual **Send Now** still uses the saved delivery configuration.

### 3. Cadence

Delivery supports:

- **Weekly** reports
- **Monthly** reports

Weekly reports use:

- weekday
- local hour
- timezone

Monthly reports use:

- day of month from 1 to 28
- local hour
- timezone

Monthly days are limited to 1-28 so reports do not get skipped in shorter months.

### 4. Timezone

When settings are saved, the app records the user's current browser timezone.

The scheduled job compares the saved timezone against the current time and sends the report when the workspace's configured local hour is reached.

### 5. Report Type

Delivery supports four report types:

| Report Type | Purpose |
| --- | --- |
| Summary report | Blends recent insights with the current open-task picture. |
| New insights | Focuses on the newest saved insights. |
| Open tasks | Focuses on unfinished work, owners, and follow-ups. |
| Risk watch | Highlights risky themes, unresolved questions, and follow-through gaps. |

The report type changes the framing and which sections are emphasized in the generated email body.

### 6. Recipient Scope

Owners/admins can choose who receives email delivery:

| Recipient Scope | Meaning |
| --- | --- |
| Owners and admins | Sends only to active workspace members with `owner` or `admin` roles. |
| All active members | Sends to all active workspace members. |

Email delivery respects each user's personal digest email preference. If a user has disabled digest emails in Personal Settings, they are skipped.

### 7. Delivery Channels

Delivery supports:

- **Email**
- **Slack**

At least one channel must be enabled before a report can be sent.

Email sends one message to each eligible recipient.

Slack requires workspace Slack delivery to be configured. If Slack is enabled for the report, users can choose:

- the default workspace Slack destination
- a saved Slack route from workspace Slack destinations

Slack destination setup itself lives under **Workspace Settings -> Integrations**.

### 8. Send Now

The **Send Now** action manually sends the current workspace report using the saved Delivery configuration.

This is useful for:

- testing the report before relying on scheduled delivery
- sending an off-cycle update before a meeting
- confirming that recipients and Slack routing are configured correctly

Manual sends are logged as report runs with `trigger: "manual"`.

### 9. Report Templates

The second part of Delivery manages reusable report configurations.

Templates save settings such as:

- target scope
- cadence
- report type
- weekday or day of month
- local hour
- timezone
- recipient scope
- email delivery
- Slack delivery
- Slack route

There are two template scopes:

| Template Scope | Purpose |
| --- | --- |
| Workspace templates | Apply directly to the workspace report form in Delivery. |
| Project templates | Apply to project recurring reports when a project is selected in Intelligence. |

Templates do not send reports by themselves. They are presets that fill report forms faster and keep reporting patterns consistent.

## What Happens When a Report Sends

When Voxly sends a workspace report, it:

1. Loads the workspace's saved Delivery settings.
2. Builds a report payload from recent workspace insights, project insights, and open tasks.
3. Finds eligible email recipients based on role, active membership, and personal digest preference.
4. Sends email if email delivery is enabled.
5. Sends Slack if Slack delivery is enabled and configured.
6. Creates in-app notifications for email recipients.
7. Updates `lastSentAt` on the workspace digest settings.
8. Writes a workspace audit log entry.
9. Creates a `RecurringReportRun` record for report history and delivery health.

Scheduled failures are also recorded as failed report runs so the Operations area can show delivery issues.

## Data Model

Delivery uses these database models:

| Model | Purpose |
| --- | --- |
| `WorkspaceDigestSettings` | Stores the active recurring workspace report settings. |
| `RecurringReportTemplate` | Stores reusable workspace/project report presets. |
| `RecurringReportRun` | Stores report delivery history, success/failure state, channel metadata, and summary. |
| `WorkspaceSlackDestination` | Stores optional named Slack routes used by workspace and project reports. |
| `UserNotificationPreferences` | Controls whether individual users receive digest emails. |

## API Surface

The Delivery section uses these endpoints:

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/workspaces/digest` | `GET` | Load current workspace report settings. |
| `/api/workspaces/digest` | `PATCH` | Save workspace report settings. |
| `/api/workspaces/digest` | `POST` | Send the workspace report immediately. |
| `/api/report-templates` | `GET` | List saved report templates for the active workspace. |
| `/api/report-templates` | `POST` | Create a reusable report template. |
| `/api/report-templates/[id]` | `DELETE` | Delete a report template in the active workspace. |
| `/api/cron/workspace-digests` | `POST` | Send all due scheduled workspace reports. |

Management endpoints require an authenticated workspace context. Mutating endpoints require owner/admin permissions and same-origin request checks.

The cron endpoint requires `WORKSPACE_DIGEST_CRON_SECRET`.

## Relationship To Other Settings

### Delivery vs. Integrations

Delivery decides whether reports should be sent to Slack and which route to use.

Integrations configures whether Slack is connected at all, the default webhook, additional Slack destinations, and Notion settings.

### Delivery vs. Personal Settings

Delivery controls workspace-level report settings.

Personal Settings control whether an individual user wants digest emails. Delivery can target all active members, but users who disabled digest emails are still excluded from email delivery.

### Delivery vs. Operations

Delivery configures reports.

Operations observes report activity and delivery health through `RecurringReportRun` records.

## Product Guidance

Use Delivery when a team wants recurring alignment without manually opening Voxly every day.

Good use cases:

- weekly leadership summary
- monthly customer research readout
- team follow-up review
- risk watch before a stakeholder meeting
- recurring Slack report into a project or operations channel

Recommended defaults for most shared workspaces:

- cadence: weekly
- report type: summary report
- recipient scope: owners and admins
- email: enabled
- Slack: enabled only after the Slack destination is verified

## Current Constraints

- Workspace Delivery currently configures one active recurring workspace report per workspace.
- Project recurring reports are configured from the project intelligence area, but their templates are visible in Delivery.
- Monthly schedules use days 1-28 only.
- Report content currently summarizes recent saved insights and active tasks; it does not generate a full new intelligence analysis at send time.
- Slack delivery depends on valid Slack workspace integration settings.
- Email delivery depends on eligible recipients and each user's digest email preference.
