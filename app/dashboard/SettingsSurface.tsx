"use client";

import {
  type FormEvent,
  type ReactNode,
  memo,
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  ActiveWorkspaceDetails,
  RecurringReportTemplate,
  UserNotificationPreferences,
  WorkspaceActivityEntry,
  WorkspaceDigestSettings,
  WorkspaceInviteEntry,
  WorkspaceMemberEntry,
  WorkspaceNotionSettings,
  WorkspaceSlackDestination,
  WorkspaceSlackSettings,
} from "./TranscriptionClient";

export type SettingsSection = "workspace" | "delivery" | "integrations" | "access" | "personal";

export type SettingsSectionMeta = Record<
  SettingsSection,
  { label: string; description: string }
>;

type SettingsSurfaceNavProps = {
  activeSection: SettingsSection;
  visibleSections: SettingsSection[];
  sectionMeta: SettingsSectionMeta;
  onSectionChange: (section: SettingsSection) => void;
};

export const SettingsSurfaceNav = memo(function SettingsSurfaceNav({
  activeSection,
  visibleSections,
  sectionMeta,
  onSectionChange,
}: SettingsSurfaceNavProps) {
  const activeMeta = sectionMeta[activeSection];

  return (
    <div className="px-5 py-4 sm:px-6 sm:py-5">
      {visibleSections.length > 1 ? (
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-slate-200 pb-3">
          {visibleSections.map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => onSectionChange(section)}
              className={`cursor-pointer border-b-2 px-0 pb-2 text-sm font-medium transition ${
                activeSection === section
                  ? "border-slate-950 text-slate-950"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {sectionMeta[section].label}
            </button>
          ))}
        </div>
      ) : null}
      <p
        className={`text-sm text-slate-500 ${
          visibleSections.length > 1 ? "mt-3" : ""
        }`}
      >
        {activeMeta.description}
      </p>
    </div>
  );
});

type DeferredCheckboxProps = {
  checked: boolean;
  disabled?: boolean;
  className?: string;
  onCheckedChange: (checked: boolean) => void;
};

export const DeferredCheckbox = memo(function DeferredCheckbox({
  checked,
  disabled,
  className,
  onCheckedChange,
}: DeferredCheckboxProps) {
  const [localChecked, setLocalChecked] = useState(checked);
  const commitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalChecked(checked);
  }, [checked]);

  useEffect(() => {
    return () => {
      if (commitTimeoutRef.current) {
        clearTimeout(commitTimeoutRef.current);
      }
    };
  }, []);

  return (
    <input
      type="checkbox"
      checked={localChecked}
      onChange={(event) => {
        const nextChecked = event.target.checked;
        setLocalChecked(nextChecked);
        if (commitTimeoutRef.current) {
          clearTimeout(commitTimeoutRef.current);
        }
        commitTimeoutRef.current = setTimeout(() => {
          startTransition(() => {
            onCheckedChange(nextChecked);
          });
        }, 80);
      }}
      disabled={disabled}
      className={className}
    />
  );
});

type PersonalSettingsSectionProps = {
  notificationPreferences: UserNotificationPreferences | null;
  notificationPreferencesLoading: boolean;
  notificationPreferencesBusy: boolean;
  mentionEmailEnabled: boolean;
  mentionInAppEnabled: boolean;
  digestEmailEnabled: boolean;
  onMentionEmailChange: (checked: boolean) => void;
  onMentionInAppChange: (checked: boolean) => void;
  onDigestEmailChange: (checked: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

type WorkspaceSettingsSectionProps = {
  activeWorkspace: ActiveWorkspaceDetails | null;
  activeWorkspaceLabel: string;
  workspaceDraftName: string;
  workspaceSettingsBusy: boolean;
  deleteWorkspaceBusy: boolean;
  onWorkspaceDraftNameChange: (name: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteWorkspace: () => void;
};

export const WorkspaceSettingsSection = memo(function WorkspaceSettingsSection({
  activeWorkspace,
  activeWorkspaceLabel,
  workspaceDraftName,
  workspaceSettingsBusy,
  deleteWorkspaceBusy,
  onWorkspaceDraftNameChange,
  onSubmit,
  onDeleteWorkspace,
}: WorkspaceSettingsSectionProps) {
  const workspaceName = activeWorkspace?.name ?? "";
  const canManageWorkspace = Boolean(activeWorkspace?.canManage);
  const canDeleteWorkspace =
    activeWorkspace?.role === "owner" && !activeWorkspace.isPersonal;

  return (
    <div id="settings" className="pt-2">
      <div className="max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Workspace Settings
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
          {activeWorkspaceLabel}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          These settings apply only to this workspace. Personal preferences are
          under Personal Settings in the main sidebar.
        </p>
      </div>
      <form onSubmit={onSubmit} className="mt-6 max-w-5xl">
        <div>
          <div className="grid gap-4 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <p className="text-sm font-semibold text-slate-900">Workspace type</p>
            </div>
            <div className="text-sm text-slate-600">
              {activeWorkspace?.isPersonal ? "Personal workspace" : "Shared workspace"}
            </div>
          </div>
          <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <p className="text-sm font-semibold text-slate-900">Your role</p>
            </div>
            <div className="text-sm text-slate-600 capitalize">
              {activeWorkspace?.role || "member"}
            </div>
          </div>
          <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <p className="text-sm font-semibold text-slate-900">Owner</p>
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">
                {activeWorkspace?.owner.name?.trim() ||
                  activeWorkspace?.owner.email ||
                  "Unknown"}
              </span>
            </div>
          </div>
          <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <p className="text-sm font-semibold text-slate-900">Workspace name</p>
              <p className="mt-1 text-sm text-slate-500">
                Update the name used throughout Voxly.
              </p>
            </div>
            <div className="flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1">
                <input
                  type="text"
                  value={workspaceDraftName}
                  onChange={(event) => onWorkspaceDraftNameChange(event.target.value)}
                  disabled={workspaceSettingsBusy || !canManageWorkspace}
                  className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
              <button
                type="submit"
                disabled={
                  workspaceSettingsBusy ||
                  !canManageWorkspace ||
                  !workspaceDraftName.trim() ||
                  workspaceDraftName.trim() === workspaceName
                }
                className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {workspaceSettingsBusy ? "Saving..." : "Save Name"}
              </button>
            </div>
          </div>
        </div>
      </form>
      {!canManageWorkspace ? (
        <p className="mt-4 max-w-5xl text-sm text-slate-600">
          You can view workspace details, but only owners and admins can update settings.
        </p>
      ) : null}
      <div className="mt-8 max-w-5xl border-t border-red-100 pt-6">
        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <div>
            <p className="text-sm font-semibold text-red-700">Delete workspace</p>
            <p className="mt-1 text-sm text-slate-500">
              Permanently remove this workspace, its projects, recordings, notes,
              comments, tasks, and saved insights.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={onDeleteWorkspace}
              disabled={deleteWorkspaceBusy || !canDeleteWorkspace}
              className="cursor-pointer rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteWorkspaceBusy ? "Deleting..." : "Delete Workspace"}
            </button>
            {!canDeleteWorkspace ? (
              <p className="mt-3 text-sm text-slate-600">
                Personal workspaces cannot be deleted. Shared workspaces can only
                be deleted by their owner.
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                You will be asked to type the workspace name before deletion.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

type DigestCadence = "weekly" | "monthly";
type DigestReportType = "summary" | "new_insights" | "open_tasks" | "risk_watch";

type DeliverySettingsSectionProps = {
  activeWorkspace: ActiveWorkspaceDetails | null;
  workspaceDigestSettings: WorkspaceDigestSettings | null;
  workspaceDigestEnabled: boolean;
  workspaceDigestCadence: DigestCadence;
  workspaceDigestWeekday: string;
  workspaceDigestDayOfMonth: string;
  workspaceDigestHour: string;
  workspaceDigestReportType: DigestReportType;
  workspaceDigestRecipientScope: string;
  workspaceDigestSendEmail: boolean;
  workspaceDigestSendSlack: boolean;
  workspaceDigestSlackDestinationId: string;
  workspaceDigestTemplateName: string;
  workspaceDigestLoading: boolean;
  workspaceDigestBusy: string | null;
  reportTemplates: RecurringReportTemplate[];
  reportTemplatesLoading: boolean;
  reportTemplateBusyKey: string | null;
  workspaceSlackDestinations: WorkspaceSlackDestination[];
  slackIntegrationConfigured: boolean;
  onNavigateToSlackIntegration: () => void;
  browserTimeZone: string;
  digestWeekdayOptions: Array<{ id: string; label: string }>;
  digestCadenceOptions: Array<{ id: string; label: string }>;
  digestRecipientOptions: Array<{ id: string; label: string }>;
  digestReportTypeOptions: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  intelligenceScope: string;
  intelligenceProjectId: string;
  onWorkspaceDigestEnabledChange: (checked: boolean) => void;
  onWorkspaceDigestCadenceChange: (value: DigestCadence) => void;
  onWorkspaceDigestWeekdayChange: (value: string) => void;
  onWorkspaceDigestDayOfMonthChange: (value: string) => void;
  onWorkspaceDigestHourChange: (value: string) => void;
  onWorkspaceDigestReportTypeChange: (value: DigestReportType) => void;
  onWorkspaceDigestRecipientScopeChange: (value: string) => void;
  onWorkspaceDigestSendEmailChange: (checked: boolean) => void;
  onWorkspaceDigestSendSlackChange: (checked: boolean) => void;
  onWorkspaceDigestSlackDestinationIdChange: (value: string) => void;
  onWorkspaceDigestTemplateNameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSendNow: () => void;
  onSaveReportTemplate: (scope: "workspace") => void;
  onApplyReportTemplate: (template: RecurringReportTemplate) => void;
  onDeleteReportTemplate: (templateId: string) => void;
};

function formatDigestHour(hour: number) {
  if (hour === 0) {
    return "12:00 AM";
  }
  if (hour < 12) {
    return `${hour}:00 AM`;
  }
  if (hour === 12) {
    return "12:00 PM";
  }
  return `${hour - 12}:00 PM`;
}

export const DeliverySettingsSection = memo(function DeliverySettingsSection({
  activeWorkspace,
  workspaceDigestSettings,
  workspaceDigestEnabled,
  workspaceDigestCadence,
  workspaceDigestWeekday,
  workspaceDigestDayOfMonth,
  workspaceDigestHour,
  workspaceDigestReportType,
  workspaceDigestRecipientScope,
  workspaceDigestSendEmail,
  workspaceDigestSendSlack,
  workspaceDigestSlackDestinationId,
  workspaceDigestTemplateName,
  workspaceDigestLoading,
  workspaceDigestBusy,
  reportTemplates,
  reportTemplatesLoading,
  reportTemplateBusyKey,
  workspaceSlackDestinations,
  slackIntegrationConfigured,
  onNavigateToSlackIntegration,
  browserTimeZone,
  digestWeekdayOptions,
  digestCadenceOptions,
  digestRecipientOptions,
  digestReportTypeOptions,
  intelligenceScope,
  intelligenceProjectId,
  onWorkspaceDigestEnabledChange,
  onWorkspaceDigestCadenceChange,
  onWorkspaceDigestWeekdayChange,
  onWorkspaceDigestDayOfMonthChange,
  onWorkspaceDigestHourChange,
  onWorkspaceDigestReportTypeChange,
  onWorkspaceDigestRecipientScopeChange,
  onWorkspaceDigestSendEmailChange,
  onWorkspaceDigestSendSlackChange,
  onWorkspaceDigestSlackDestinationIdChange,
  onWorkspaceDigestTemplateNameChange,
  onSubmit,
  onSendNow,
  onSaveReportTemplate,
  onApplyReportTemplate,
  onDeleteReportTemplate,
}: DeliverySettingsSectionProps) {
  const canManageWorkspace = Boolean(activeWorkspace?.canManage);

  return (
    <>
      <div className="pt-2">
        <div className="max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Recurring Report
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
            Scheduled insight report
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Configure a recurring workspace report, choose what it covers, and decide
            how it should be delivered.
          </p>
          {workspaceDigestSettings ? (
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
              <span>{workspaceDigestSettings.enabled ? "Enabled" : "Paused"}</span>
              <span>
                {digestReportTypeOptions.find(
                  (option) => option.id === workspaceDigestSettings.reportType,
                )?.label || "Summary report"}
              </span>
              <span>{workspaceDigestSettings.scheduleLabel}</span>
              <span>
                {workspaceDigestSettings.lastSentAt
                  ? `Last sent ${new Date(
                      workspaceDigestSettings.lastSentAt,
                    ).toLocaleString()}`
                  : "Not sent yet"}
              </span>
              {workspaceDigestSettings.nextRunAt ? (
                <span>
                  {`Next run ${new Date(
                    workspaceDigestSettings.nextRunAt,
                  ).toLocaleString()}`}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <form onSubmit={onSubmit} className="mt-6 max-w-5xl">
          <div>
            <div className="grid gap-4 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-semibold text-slate-900">Digest status</p>
                <p className="mt-1 text-sm text-slate-500">
                  Turn the recurring workspace report on or leave it paused.
                </p>
              </div>
              <label className="flex items-start justify-between gap-4 rounded-[8px] bg-[#fcfbf8] px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Recurring workspace report
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    When enabled, Voxly will run this report on the saved schedule.
                  </p>
                </div>
                <DeferredCheckbox
                  checked={workspaceDigestEnabled}
                  onCheckedChange={onWorkspaceDigestEnabledChange}
                  disabled={workspaceDigestLoading || !canManageWorkspace}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed"
                />
              </label>
            </div>

            <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-semibold text-slate-900">Cadence</p>
                <p className="mt-1 text-sm text-slate-500">
                  Choose how often the report should run.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="text-xs font-medium text-slate-600">Frequency</span>
                  <select
                    value={workspaceDigestCadence}
                    onChange={(event) =>
                      onWorkspaceDigestCadenceChange(
                        event.target.value as DigestCadence,
                      )
                    }
                    disabled={workspaceDigestLoading || !canManageWorkspace}
                    className="mt-2 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {digestCadenceOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {workspaceDigestCadence === "weekly" ? (
                  <label>
                    <span className="text-xs font-medium text-slate-600">Day</span>
                    <select
                      value={workspaceDigestWeekday}
                      onChange={(event) =>
                        onWorkspaceDigestWeekdayChange(event.target.value)
                      }
                      disabled={workspaceDigestLoading || !canManageWorkspace}
                      className="mt-2 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {digestWeekdayOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    <span className="text-xs font-medium text-slate-600">
                      Day of month
                    </span>
                    <select
                      value={workspaceDigestDayOfMonth}
                      onChange={(event) =>
                        onWorkspaceDigestDayOfMonthChange(event.target.value)
                      }
                      disabled={workspaceDigestLoading || !canManageWorkspace}
                      className="mt-2 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {Array.from({ length: 28 }, (_, index) => {
                        const day = index + 1;
                        return (
                          <option key={day} value={String(day)}>
                            Day {day}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                )}
                <label className="sm:col-span-2">
                  <span className="text-xs font-medium text-slate-600">Local hour</span>
                  <select
                    value={workspaceDigestHour}
                    onChange={(event) => onWorkspaceDigestHourChange(event.target.value)}
                    disabled={workspaceDigestLoading || !canManageWorkspace}
                    className="mt-2 w-full max-w-xs cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {Array.from({ length: 24 }, (_, hour) => (
                      <option key={hour} value={String(hour)}>
                        {formatDigestHour(hour)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-semibold text-slate-900">Report content</p>
                <p className="mt-1 text-sm text-slate-500">
                  Choose what the report covers and who should receive it.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="text-xs font-medium text-slate-600">Report type</span>
                  <select
                    value={workspaceDigestReportType}
                    onChange={(event) =>
                      onWorkspaceDigestReportTypeChange(
                        event.target.value as DigestReportType,
                      )
                    }
                    disabled={workspaceDigestLoading || !canManageWorkspace}
                    className="mt-2 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {digestReportTypeOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    {
                      digestReportTypeOptions.find(
                        (option) => option.id === workspaceDigestReportType,
                      )?.description
                    }
                  </p>
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-600">
                    Recipient scope
                  </span>
                  <select
                    value={workspaceDigestRecipientScope}
                    onChange={(event) =>
                      onWorkspaceDigestRecipientScopeChange(event.target.value)
                    }
                    disabled={workspaceDigestLoading || !canManageWorkspace}
                    className="mt-2 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {digestRecipientOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-semibold text-slate-900">Delivery channels</p>
                <p className="mt-1 text-sm text-slate-500">
                  Choose where the recurring report should be sent.
                </p>
              </div>
              <div className="space-y-4">
                <label className="flex items-start justify-between gap-4 rounded-[16px] border border-slate-200 bg-white px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Email</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Respect each member&apos;s personal digest email preference.
                    </p>
                  </div>
                  <DeferredCheckbox
                    checked={workspaceDigestSendEmail}
                    onCheckedChange={onWorkspaceDigestSendEmailChange}
                    disabled={workspaceDigestLoading || !canManageWorkspace}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed"
                  />
                </label>
                <label className={`flex items-start justify-between gap-4 rounded-[16px] border px-4 py-4 ${slackIntegrationConfigured ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-60"}`}>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Slack</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {slackIntegrationConfigured
                        ? "Send this report to a Slack channel."
                        : "Connect Slack in Integrations to enable this channel."}
                    </p>
                  </div>
                  <DeferredCheckbox
                    checked={workspaceDigestSendSlack}
                    onCheckedChange={onWorkspaceDigestSendSlackChange}
                    disabled={workspaceDigestLoading || !canManageWorkspace || !slackIntegrationConfigured}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed"
                  />
                </label>
                {!slackIntegrationConfigured && (
                  <div className="flex items-start gap-3 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800">Slack not connected</p>
                      <p className="mt-0.5 text-xs text-amber-700">
                        Set up the Slack integration before enabling this delivery channel.
                      </p>
                      <button
                        type="button"
                        onClick={onNavigateToSlackIntegration}
                        className="mt-2 cursor-pointer text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
                      >
                        Go to Integrations →
                      </button>
                    </div>
                  </div>
                )}
                {workspaceDigestSendSlack && slackIntegrationConfigured ? (
                  <label className="block max-w-md">
                    <span className="text-xs font-medium text-slate-600">
                      Slack route
                    </span>
                    <select
                      value={workspaceDigestSlackDestinationId}
                      onChange={(event) =>
                        onWorkspaceDigestSlackDestinationIdChange(event.target.value)
                      }
                      disabled={workspaceDigestLoading || !canManageWorkspace}
                      className="mt-2 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="default">Default workspace destination</option>
                      {workspaceSlackDestinations.map((destination) => (
                        <option key={destination.id} value={destination.id}>
                          {destination.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-semibold text-slate-900">Timezone</p>
                <p className="mt-1 text-sm text-slate-500">
                  Reports use your current browser timezone when settings are saved.
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {workspaceDigestSettings?.timezone || browserTimeZone}
                </p>
                <p className="mt-1 text-sm text-slate-500">{browserTimeZone}</p>
              </div>
            </div>

            <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-semibold text-slate-900">Actions</p>
                <p className="mt-1 text-sm text-slate-500">
                  Save the recurring report or send a manual run now.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={workspaceDigestBusy !== null || !canManageWorkspace}
                  className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {workspaceDigestBusy === "save" ? "Saving..." : "Save Digest Settings"}
                </button>
                <button
                  type="button"
                  onClick={onSendNow}
                  disabled={
                    workspaceDigestBusy !== null ||
                    !canManageWorkspace ||
                    (!workspaceDigestSendEmail &&
                      workspaceDigestSendSlack &&
                      !slackIntegrationConfigured)
                  }
                  title={
                    !workspaceDigestSendEmail &&
                    workspaceDigestSendSlack &&
                    !slackIntegrationConfigured
                      ? "Connect Slack in Integrations before sending"
                      : undefined
                  }
                  className="cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {workspaceDigestBusy === "send" ? "Sending..." : "Send Now"}
                </button>
              </div>
            </div>

            <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-semibold text-slate-900">Save as template</p>
                <p className="mt-1 text-sm text-slate-500">
                  Save this delivery setup so you can reuse it later.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1 max-w-md">
                  <span className="text-xs font-medium text-slate-600">Template name</span>
                  <input
                    type="text"
                    value={workspaceDigestTemplateName}
                    onChange={(event) =>
                      onWorkspaceDigestTemplateNameChange(event.target.value)
                    }
                    disabled={!canManageWorkspace || workspaceDigestLoading}
                    placeholder="Weekly risk watch"
                    className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onSaveReportTemplate("workspace")}
                  disabled={
                    !canManageWorkspace ||
                    reportTemplateBusyKey !== null ||
                    !workspaceDigestTemplateName.trim()
                  }
                  className="cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reportTemplateBusyKey === "save:workspace"
                    ? "Saving..."
                    : "Save Template"}
                </button>
              </div>
            </div>
          </div>
        </form>
        {!canManageWorkspace ? (
          <p className="mt-4 max-w-5xl text-sm text-slate-600">
            Only owners and admins can manage workspace digests or send them manually.
          </p>
        ) : null}
      </div>

      <div className="pt-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Report Templates
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
              Reuse recurring report setups
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Save your best workspace and project report configurations, then
              apply them without rebuilding cadence, recipients, and report type
              from scratch.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          {(["workspace", "project"] as const).map((scope) => {
            const templatesForScope = reportTemplates.filter(
              (template) => template.targetScope === scope,
            );
            return (
              <div key={scope} className="pt-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {scope === "workspace" ? "Workspace templates" : "Project templates"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {scope === "workspace"
                        ? "Apply directly to the workspace report form."
                        : "Apply when a project is selected in intelligence."}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    {templatesForScope.length}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {templatesForScope.length ? (
                    templatesForScope.map((template) => (
                      <div
                        key={template.id}
                        className="border-t border-slate-200 pt-3 first:border-t-0 first:pt-0"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {template.name}
                          </p>
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                            {template.cadence}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                            {digestReportTypeOptions.find(
                              (option) => option.id === template.reportType,
                            )?.label || template.reportType}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {template.cadence === "monthly"
                            ? `Day ${template.dayOfMonth}`
                            : digestWeekdayOptions.find(
                                (option) => Number(option.id) === template.weekday,
                              )?.label || "Weekly"}{" "}
                          at {formatDigestHour(template.hourLocal)}
                          {" - "}
                          {
                            digestRecipientOptions.find(
                              (option) => option.id === template.recipientScope,
                            )?.label
                          }
                          {" - "}
                          {[
                            template.sendEmail ? "Email" : null,
                            template.sendSlack ? "Slack" : null,
                          ]
                            .filter(Boolean)
                            .join(" + ") || "No delivery"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onApplyReportTemplate(template)}
                            disabled={
                              scope === "project" &&
                              (intelligenceScope !== "project" ||
                                intelligenceProjectId === "all")
                            }
                            className="cursor-pointer rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteReportTemplate(template.id)}
                            disabled={reportTemplateBusyKey !== null || !canManageWorkspace}
                            className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {reportTemplateBusyKey === `delete:${template.id}`
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      {reportTemplatesLoading
                        ? "Loading templates..."
                        : "No templates saved yet."}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
});

type IntegrationSettingsSectionProps = {
  activeWorkspace: ActiveWorkspaceDetails | null;
  activeWorkspaceLabel: string;
  workspaceSlackSettings: WorkspaceSlackSettings | null;
  workspaceSlackWebhookDraft: string;
  workspaceSlackLoading: boolean;
  workspaceSlackBusy: string | null;
  workspaceSlackEnabled: boolean;
  workspaceSlackSendDigests: boolean;
  workspaceNotionSettings: WorkspaceNotionSettings | null;
  workspaceNotionLoading: boolean;
  workspaceNotionBusy: string | null;
  workspaceNotionEnabled: boolean;
  workspaceNotionTokenDraft: string;
  workspaceNotionParentPageDraft: string;
  integrationError: string | null;
  onWorkspaceSlackWebhookDraftChange: (value: string) => void;
  onWorkspaceSlackEnabledChange: (checked: boolean) => void;
  onWorkspaceSlackSendDigestsChange: (checked: boolean) => void;
  onWorkspaceNotionTokenDraftChange: (value: string) => void;
  onWorkspaceNotionParentPageDraftChange: (value: string) => void;
  onWorkspaceNotionEnabledChange: (checked: boolean) => void;
  onSlackSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSendSlackTest: () => void;
  onDeleteSlackSettings: () => void;
  onNotionSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onValidateNotion: () => void;
  onDeleteNotionSettings: () => void;
};

function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "neutral";
  children: ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}
    >
      {children}
    </span>
  );
}

export const IntegrationSettingsSection = memo(function IntegrationSettingsSection({
  activeWorkspace,
  activeWorkspaceLabel,
  workspaceSlackSettings,
  workspaceSlackWebhookDraft,
  workspaceSlackLoading,
  workspaceSlackBusy,
  workspaceSlackEnabled,
  workspaceSlackSendDigests,
  workspaceNotionSettings,
  workspaceNotionLoading,
  workspaceNotionBusy,
  workspaceNotionEnabled,
  workspaceNotionTokenDraft,
  workspaceNotionParentPageDraft,
  integrationError,
  onWorkspaceSlackWebhookDraftChange,
  onWorkspaceSlackEnabledChange,
  onWorkspaceSlackSendDigestsChange,
  onWorkspaceNotionTokenDraftChange,
  onWorkspaceNotionParentPageDraftChange,
  onWorkspaceNotionEnabledChange,
  onSlackSubmit,
  onSendSlackTest,
  onDeleteSlackSettings,
  onNotionSubmit,
  onValidateNotion,
  onDeleteNotionSettings,
}: IntegrationSettingsSectionProps) {
  const canManageWorkspace = Boolean(activeWorkspace?.canManage);
  const hasUnsavedNotionConnection =
    Boolean(workspaceNotionTokenDraft.trim()) &&
    Boolean(workspaceNotionParentPageDraft.trim());
  const canValidateNotionConnection =
    Boolean(workspaceNotionSettings?.configured) || hasUnsavedNotionConnection;

  return (
    <>
      <div className="pt-2">
        <div className="max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Slack
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
            Slack integration
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Connect Slack for {activeWorkspaceLabel}. The main switch controls
            whether Voxly can post to Slack at all; the report switch controls
            whether scheduled and manual reports may use Slack.
          </p>
          {workspaceSlackSettings ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <StatusPill
                tone={workspaceSlackSettings.configured ? "success" : "neutral"}
              >
                {workspaceSlackSettings.configured ? "Connected" : "Disconnected"}
              </StatusPill>
              <StatusPill
                tone={workspaceSlackSettings.enabled ? "success" : "warning"}
              >
                {workspaceSlackSettings.enabled ? "Enabled" : "Paused"}
              </StatusPill>
              {workspaceSlackSettings.maskedWebhook ? (
                <span className="px-1 text-slate-500">
                  {workspaceSlackSettings.maskedWebhook}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <form onSubmit={onSlackSubmit} className="mt-6 max-w-5xl">
          <div>
            <div className="grid gap-4 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-semibold text-slate-900">Webhook</p>
                <p className="mt-1 text-sm text-slate-500">
                  Paste the incoming webhook Voxly should use.
                </p>
              </div>
              <div className="max-w-2xl">
                <input
                  type="password"
                  value={workspaceSlackWebhookDraft}
                  onChange={(event) =>
                    onWorkspaceSlackWebhookDraftChange(event.target.value)
                  }
                  placeholder={
                    workspaceSlackSettings?.configured
                      ? "Paste a new webhook URL to replace the current one"
                      : "https://hooks.slack.com/services/..."
                  }
                  disabled={workspaceSlackLoading || !canManageWorkspace}
                  className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="mt-2 text-sm text-slate-500">
                  Voxly stores the webhook server-side and only shows a masked value
                  after it is saved.
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Need a webhook? In Slack, create or open a Slack app, turn on
                  Incoming Webhooks, add a webhook to the channel Voxly should post
                  to, then paste the generated URL here.{" "}
                  <a
                    href="https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-slate-900 underline underline-offset-4"
                  >
                    Open Slack webhook guide
                  </a>
                  .
                </p>
              </div>
            </div>
            <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-semibold text-slate-900">Slack access</p>
                <p className="mt-1 text-sm text-slate-500">
                  Turn on Slack first, then choose whether reports can post there.
                </p>
              </div>
              <div className="space-y-4">
                <label className="flex items-start justify-between gap-4 rounded-[16px] border border-slate-200 bg-white px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Enable Slack integration
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Allows Voxly to post test messages and shared insights to
                      the saved Slack webhook.
                    </p>
                  </div>
                  <DeferredCheckbox
                    checked={workspaceSlackEnabled}
                    onCheckedChange={onWorkspaceSlackEnabledChange}
                    disabled={workspaceSlackLoading || !canManageWorkspace}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed"
                  />
                </label>
                <label className="flex items-start justify-between gap-4 rounded-[16px] border border-slate-200 bg-white px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Allow reports in Slack
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Lets workspace and project reports post to Slack when a report
                      also has Slack selected in Delivery.
                    </p>
                  </div>
                  <DeferredCheckbox
                    checked={workspaceSlackEnabled && workspaceSlackSendDigests}
                    onCheckedChange={onWorkspaceSlackSendDigestsChange}
                    disabled={
                      workspaceSlackLoading ||
                      !canManageWorkspace ||
                      !workspaceSlackEnabled
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed"
                  />
                </label>
              </div>
            </div>
            <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-semibold text-slate-900">Actions</p>
              </div>
              <div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={
                      workspaceSlackBusy !== null ||
                      !canManageWorkspace ||
                      (!workspaceSlackWebhookDraft.trim() &&
                        !workspaceSlackSettings?.configured)
                    }
                    className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {workspaceSlackBusy === "save" ? "Saving..." : "Save Slack Settings"}
                  </button>
                  <button
                    type="button"
                    onClick={onSendSlackTest}
                    disabled={
                      workspaceSlackBusy !== null ||
                      !canManageWorkspace ||
                      !workspaceSlackSettings?.configured ||
                      !workspaceSlackEnabled
                    }
                    className="cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {workspaceSlackBusy === "test" ? "Sending..." : "Send Test"}
                  </button>
                  <button
                    type="button"
                    onClick={onDeleteSlackSettings}
                    disabled={
                      workspaceSlackBusy !== null ||
                      !canManageWorkspace ||
                      !workspaceSlackSettings?.configured
                    }
                    className="cursor-pointer rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {workspaceSlackBusy === "delete"
                      ? "Disconnecting..."
                      : "Disconnect Slack"}
                  </button>
                </div>
                {!workspaceSlackWebhookDraft.trim() &&
                !workspaceSlackSettings?.configured ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Paste a Slack incoming webhook before saving changes.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </form>
        {!canManageWorkspace ? (
          <p className="mt-4 max-w-5xl text-sm text-slate-600">
            Only owners and admins can manage Slack integration settings.
          </p>
        ) : null}
      </div>

      {integrationError ? (
        <div
          role="alert"
          className="max-w-5xl rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {integrationError}
        </div>
      ) : null}

      <div className="pt-2">
        <div className="max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Notion
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
            Workspace knowledge sync
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Connect Notion for {activeWorkspaceLabel}. Voxly uses an internal
            integration token and a parent page ID to publish saved insights as
            Notion pages.
          </p>
          {workspaceNotionSettings ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <StatusPill
                tone={workspaceNotionSettings.configured ? "success" : "neutral"}
              >
                {workspaceNotionSettings.configured ? "Connected" : "Disconnected"}
              </StatusPill>
              <StatusPill
                tone={workspaceNotionSettings.enabled ? "success" : "warning"}
              >
                {workspaceNotionSettings.enabled ? "Enabled" : "Paused"}
              </StatusPill>
              {workspaceNotionSettings.parentPageId ? (
                <span className="px-1 text-slate-500">
                  Parent page: {workspaceNotionSettings.parentPageId}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <form onSubmit={onNotionSubmit} className="mt-6 max-w-5xl">
          <div>
            <div className="grid gap-4 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-semibold text-slate-900">Integration token</p>
                <p className="mt-1 text-sm text-slate-500">
                  This is the secret for your Notion internal integration.
                </p>
              </div>
              <div className="max-w-2xl">
                <input
                  type="password"
                  value={workspaceNotionTokenDraft}
                  onChange={(event) =>
                    onWorkspaceNotionTokenDraftChange(event.target.value)
                  }
                  placeholder={
                    workspaceNotionSettings?.configured
                      ? "Saved token is stored. Paste a new token to replace it"
                      : "secret_xxx..."
                  }
                  disabled={workspaceNotionLoading || !canManageWorkspace}
                  className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="mt-2 text-sm text-slate-500">
                  {workspaceNotionSettings?.maskedToken ? (
                    <>
                      Current token: {workspaceNotionSettings.maskedToken}.{" "}
                    </>
                  ) : null}
                  Create or open a Notion integration, copy its internal
                  integration secret, and make sure the target page is shared with
                  that integration.{" "}
                  <a
                    href="https://developers.notion.com/guides/get-started/create-a-notion-integration"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-slate-900 underline underline-offset-4"
                  >
                    Open Notion integration guide
                  </a>
                  .
                </p>
              </div>
            </div>
            <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-semibold text-slate-900">Parent page</p>
                <p className="mt-1 text-sm text-slate-500">
                  Voxly creates new insight pages under this Notion page.
                </p>
              </div>
              <div className="max-w-2xl">
                <input
                  type="text"
                  value={workspaceNotionParentPageDraft}
                  onChange={(event) =>
                    onWorkspaceNotionParentPageDraftChange(event.target.value)
                  }
                  placeholder="Paste the parent page ID"
                  disabled={workspaceNotionLoading || !canManageWorkspace}
                  className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="mt-2 text-sm text-slate-500">
                  Open the Notion page, copy its link, then paste the page ID from
                  the end of the URL. The page must be shared with your integration.
                  {" "}
                  <a
                    href="https://developers.notion.com/guides/get-started/create-a-notion-integration#give-your-integration-page-permissions"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-slate-900 underline underline-offset-4"
                  >
                    Open Notion page sharing guide
                  </a>
                  .
                </p>
              </div>
            </div>
            <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-semibold text-slate-900">Availability</p>
              </div>
              <label className="flex items-start justify-between gap-4 rounded-[16px] border border-slate-200 bg-white px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Enable Notion publishing
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Allows saved insights to create real pages in Notion.
                  </p>
                </div>
                <DeferredCheckbox
                  checked={workspaceNotionEnabled}
                  onCheckedChange={onWorkspaceNotionEnabledChange}
                  disabled={workspaceNotionLoading || !canManageWorkspace}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed"
                />
              </label>
            </div>
            <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-semibold text-slate-900">Actions</p>
              </div>
              <div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={
                      workspaceNotionBusy !== null ||
                      !canManageWorkspace ||
                      ((!workspaceNotionTokenDraft.trim() ||
                        !workspaceNotionParentPageDraft.trim()) &&
                        !workspaceNotionSettings?.configured)
                    }
                    className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {workspaceNotionBusy === "save"
                      ? "Saving..."
                      : "Save Notion Settings"}
                  </button>
                  <button
                    type="button"
                    onClick={onValidateNotion}
                    disabled={
                      workspaceNotionBusy !== null ||
                      workspaceNotionLoading ||
                      !canManageWorkspace ||
                      !canValidateNotionConnection ||
                      !workspaceNotionEnabled
                    }
                    className="cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {workspaceNotionBusy === "validate"
                      ? "Checking..."
                      : "Validate Connection"}
                  </button>
                  <button
                    type="button"
                    onClick={onDeleteNotionSettings}
                    disabled={
                      workspaceNotionBusy !== null ||
                      workspaceNotionLoading ||
                      !canManageWorkspace ||
                      !workspaceNotionSettings?.configured
                    }
                    className="cursor-pointer rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {workspaceNotionBusy === "delete"
                      ? "Disconnecting..."
                      : "Disconnect Notion"}
                  </button>
                </div>
                {(!workspaceNotionTokenDraft.trim() ||
                  !workspaceNotionParentPageDraft.trim()) &&
                !workspaceNotionSettings?.configured ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Add both the Notion integration token and parent page ID before
                    saving changes.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </form>
        {!canManageWorkspace ? (
          <p className="mt-4 max-w-5xl text-sm text-slate-600">
            Only owners and admins can manage Notion integration settings.
          </p>
        ) : null}
      </div>
    </>
  );
});

type AccessSettingsSectionProps = {
  activeWorkspace: ActiveWorkspaceDetails | null;
  activeWorkspaceLabel: string;
  inviteEmail: string;
  inviteRole: string;
  inviteBusy: boolean;
  memberBusyId: string | null;
  ownerTransferMemberId: string;
  ownerTransferBusy: boolean;
  leaveWorkspaceBusy: boolean;
  workspaceMembers: WorkspaceMemberEntry[];
  workspaceInvites: WorkspaceInviteEntry[];
  workspacePeopleLoading: boolean;
  workspaceActivity: WorkspaceActivityEntry[];
  workspaceActivityLoading: boolean;
  ownershipTransferBlockedByBilling: boolean;
  onInviteEmailChange: (value: string) => void;
  onInviteRoleChange: (value: string) => void;
  onOwnerTransferMemberIdChange: (value: string) => void;
  onInviteSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateMemberRole: (memberId: string, role: string) => void;
  onRemoveMember: (memberId: string) => void;
  onResendInvite: (inviteId: string) => void;
  onRevokeInvite: (inviteId: string) => void;
  onTransferOwnership: () => void;
  onLeaveWorkspace: () => void;
};

export const AccessSettingsSection = memo(function AccessSettingsSection({
  activeWorkspace,
  activeWorkspaceLabel,
  inviteEmail,
  inviteRole,
  inviteBusy,
  memberBusyId,
  ownerTransferMemberId,
  ownerTransferBusy,
  leaveWorkspaceBusy,
  workspaceMembers,
  workspaceInvites,
  workspacePeopleLoading,
  workspaceActivity,
  workspaceActivityLoading,
  ownershipTransferBlockedByBilling,
  onInviteEmailChange,
  onInviteRoleChange,
  onOwnerTransferMemberIdChange,
  onInviteSubmit,
  onUpdateMemberRole,
  onRemoveMember,
  onResendInvite,
  onRevokeInvite,
  onTransferOwnership,
  onLeaveWorkspace,
}: AccessSettingsSectionProps) {
  const canManageWorkspace = Boolean(activeWorkspace?.canManage);
  const [currentTime] = useState(() => Date.now());

  return (
    <>
      <div className="pt-2">
        <div className="max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Workspace Access
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
            Members and invites
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Manage who can access {activeWorkspaceLabel}, what role they have,
            and how ownership is handled.
          </p>
        </div>
        <form onSubmit={onInviteSubmit} className="mt-6 max-w-5xl">
          <div>
            <div className="grid gap-4 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-semibold text-slate-900">Invite teammate</p>
                <p className="mt-1 text-sm text-slate-500">
                  Send an invite to {activeWorkspaceLabel} and choose the initial role.
                </p>
              </div>
              <div className="flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => onInviteEmailChange(event.target.value)}
                    placeholder="teammate@company.com"
                    disabled={!canManageWorkspace || inviteBusy}
                    className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </label>
                <label className="sm:w-44">
                  <select
                    value={inviteRole}
                    onChange={(event) => onInviteRoleChange(event.target.value)}
                    disabled={!canManageWorkspace || inviteBusy}
                    className="w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={inviteBusy || !inviteEmail.trim() || !canManageWorkspace}
                  className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {inviteBusy ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </div>
          </div>
        </form>
        {!canManageWorkspace ? (
          <p className="mt-3 max-w-5xl text-sm text-slate-600">
            Only owners and admins can invite teammates to {activeWorkspaceLabel}.
          </p>
        ) : null}
      </div>

      <div className="mt-8 max-w-5xl">
        <div className="pt-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Active members</h3>
            <span className="text-sm text-slate-500">{workspaceMembers.length}</span>
          </div>
          <div className="mt-4 space-y-4">
            {workspacePeopleLoading ? (
              <p className="text-sm text-slate-500">
                Loading members for {activeWorkspaceLabel}...
              </p>
            ) : workspaceMembers.length ? (
              workspaceMembers.map((member) => (
                <div key={member.id} className="border-t border-slate-200 pt-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {member.user.name?.trim() || member.user.email}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {member.user.email}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Joined{" "}
                        {member.joinedAt
                          ? new Date(member.joinedAt).toLocaleDateString()
                          : "recently"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={member.role}
                        onChange={(event) =>
                          onUpdateMemberRole(member.id, event.target.value)
                        }
                        disabled={
                          memberBusyId === member.id ||
                          member.role === "owner" ||
                          !canManageWorkspace
                        }
                        className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => onRemoveMember(member.id)}
                        disabled={
                          memberBusyId === member.id ||
                          member.role === "owner" ||
                          !canManageWorkspace
                        }
                        className="cursor-pointer rounded-full border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No teammates in {activeWorkspaceLabel} yet.
              </p>
            )}
          </div>
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Pending invites</h3>
            <span className="text-sm text-slate-500">{workspaceInvites.length}</span>
          </div>
          <div className="mt-4 space-y-4">
            {workspacePeopleLoading ? (
              <p className="text-sm text-slate-500">
                Loading invites for {activeWorkspaceLabel}...
              </p>
            ) : workspaceInvites.length ? (
              workspaceInvites.map((invite) => {
                const isExpired = new Date(invite.expiresAt).getTime() < currentTime;

                return (
                  <div key={invite.id} className="border-t border-slate-200 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {invite.email}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {invite.role} - {isExpired ? "expired" : "expires"}{" "}
                          {new Date(invite.expiresAt).toLocaleDateString()}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Sent {new Date(invite.createdAt).toLocaleDateString()}
                          {invite.updatedAt && invite.updatedAt !== invite.createdAt
                            ? ` - resent ${new Date(invite.updatedAt).toLocaleDateString()}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                            isExpired
                              ? "border border-amber-200 bg-amber-50 text-amber-700"
                              : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {isExpired ? "Expired" : "Pending"}
                        </span>
                        <button
                          type="button"
                          onClick={() => onResendInvite(invite.id)}
                          disabled={inviteBusy || !canManageWorkspace}
                          className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Resend
                        </button>
                        <button
                          type="button"
                          onClick={() => onRevokeInvite(invite.id)}
                          disabled={inviteBusy || !canManageWorkspace}
                          className="cursor-pointer rounded-full border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">
                No pending invites for {activeWorkspaceLabel} right now.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 max-w-5xl">
        <div className="pt-2">
          <h3 className="text-sm font-semibold text-slate-900">Ownership</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Transfer ownership of {activeWorkspaceLabel} before an owner steps
            away. Personal workspaces cannot be transferred.
          </p>
          {ownershipTransferBlockedByBilling ? (
            <p className="mt-3 text-sm text-amber-800">
              Ownership transfer is blocked while the current owner still has active
              subscription access or remaining credits tied to this workspace.
            </p>
          ) : null}
          <div className="mt-4 flex max-w-3xl flex-col gap-3 lg:flex-row lg:items-end">
            <label className="flex-1">
              <select
                value={ownerTransferMemberId}
                onChange={(event) =>
                  onOwnerTransferMemberIdChange(event.target.value)
                }
                disabled={ownerTransferBusy || ownershipTransferBlockedByBilling}
                className="w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Choose a member</option>
                {workspaceMembers
                  .filter((member) => member.role !== "owner")
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.user.name?.trim() || member.user.email}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              onClick={onTransferOwnership}
              disabled={
                ownerTransferBusy ||
                !ownerTransferMemberId ||
                ownershipTransferBlockedByBilling
              }
              className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ownerTransferBusy ? "Transferring..." : "Transfer Owner"}
            </button>
          </div>
        </div>

        <div className="pt-2">
          <h3 className="text-sm font-semibold text-slate-900">Leave workspace</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Non-owners can leave {activeWorkspaceLabel} at any time. Owners must
            transfer ownership first.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={onLeaveWorkspace}
              disabled={leaveWorkspaceBusy}
              className="cursor-pointer rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {leaveWorkspaceBusy ? "Leaving..." : "Leave Workspace"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 max-w-5xl pt-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Recent activity</h3>
            <p className="mt-1 text-sm text-slate-600">
              Access changes for {activeWorkspaceLabel} are logged here for accountability.
            </p>
          </div>
          <span className="text-sm text-slate-500">{workspaceActivity.length}</span>
        </div>
        <div className="mt-4 space-y-4">
          {workspaceActivityLoading ? (
            <p className="text-sm text-slate-500">
              Loading activity for {activeWorkspaceLabel}...
            </p>
          ) : workspaceActivity.length ? (
            workspaceActivity.map((entry) => (
              <div key={entry.id} className="border-t border-slate-200 pt-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {entry.summary}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {(entry.actorUser?.name?.trim() ||
                        entry.actorUser?.email ||
                        "System") +
                        " - " +
                        new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {entry.action.replaceAll(".", " ")}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              Activity for {activeWorkspaceLabel} will appear here as invites and
              membership changes happen.
            </p>
          )}
        </div>
      </div>
    </>
  );
});

export const PersonalSettingsSection = memo(function PersonalSettingsSection({
  notificationPreferences,
  notificationPreferencesLoading,
  notificationPreferencesBusy,
  mentionEmailEnabled,
  mentionInAppEnabled,
  digestEmailEnabled,
  onMentionEmailChange,
  onMentionInAppChange,
  onDigestEmailChange,
  onSubmit,
}: PersonalSettingsSectionProps) {
  const preferences = [
    {
      key: "mention-email",
      title: "Mention emails",
      body: "Email me when I'm mentioned",
      note: "Applies to transcript, task, and insight mentions.",
      checked: mentionEmailEnabled,
      setChecked: onMentionEmailChange,
    },
    {
      key: "mention-app",
      title: "In-app mentions",
      body: "Show mention notifications in Voxly",
      note: "Controls the in-app notification center.",
      checked: mentionInAppEnabled,
      setChecked: onMentionInAppChange,
    },
    {
      key: "digest-email",
      title: "Digest emails",
      body: "Receive workspace digest emails",
      note: "Slack digests and in-app activity are not affected.",
      checked: digestEmailEnabled,
      setChecked: onDigestEmailChange,
    },
  ];

  return (
    <div className="pt-6">
      <div className="max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Personal Settings
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
          Personal notification preferences
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Choose how Voxly reaches you for mentions and digest emails across
          your workspaces. These preferences follow your user account, not a
          single workspace.
        </p>
        {notificationPreferences ? (
          <p className="mt-3 text-xs text-slate-500">
            Updated {new Date(notificationPreferences.updatedAt).toLocaleString()}
          </p>
        ) : null}
      </div>
      <form onSubmit={onSubmit} className="mt-6 max-w-5xl">
        <div>
          {preferences.map((item) => (
            <div
              key={item.key}
              className="grid gap-4 py-6 md:grid-cols-[220px_minmax(0,1fr)]"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              </div>
              <label className="flex items-start justify-between gap-4 rounded-[16px] border border-slate-200 bg-white px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.body}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.note}</p>
                </div>
                <DeferredCheckbox
                  checked={item.checked}
                  onCheckedChange={item.setChecked}
                  disabled={notificationPreferencesLoading || notificationPreferencesBusy}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed"
                />
              </label>
            </div>
          ))}
          <div className="flex justify-center py-6">
            <button
              type="submit"
              disabled={notificationPreferencesLoading || notificationPreferencesBusy}
              className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {notificationPreferencesBusy ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
});
