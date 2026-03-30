import { DANGEROUS_AUTOMATION_MUTATION_TOKEN } from "../../../shared/safety/automationMutationSafetyPolicy";
import type {
  AutomationGuidedDraft,
  AutomationGuidedDraftErrors,
} from "./AutomationsDashboard.types";

type AutomationsDashboardEditorProps = {
  draft: AutomationGuidedDraft;
  errors: AutomationGuidedDraftErrors;
  mode: "create" | "edit";
  pending: boolean;
  requiredSafetyAction: "immediate" | "confirm" | "explicit";
  onDraftChange: (nextDraft: AutomationGuidedDraft) => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
};

export function AutomationsDashboardEditor({
  draft,
  errors,
  mode,
  pending,
  requiredSafetyAction,
  onDraftChange,
  onSubmit,
  onCancelEdit,
}: AutomationsDashboardEditorProps) {
  return (
    <form
      className="space-y-3 rounded-md border border-border/70 bg-card/60 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">
          {mode === "create" ? "Create automation (guided)" : "Edit automation (guided)"}
        </p>
        {mode === "edit" ? (
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
            onClick={onCancelEdit}
            disabled={pending}
          >
            Cancel edit
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Name</span>
          <input
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            type="text"
            maxLength={32}
            value={draft.name}
            onChange={(event) => {
              onDraftChange({ ...draft, name: event.target.value });
            }}
            disabled={pending}
          />
          {errors.name ? <p className="text-xs text-red-200">{errors.name}</p> : null}
        </label>

        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Status</span>
          <select
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            value={draft.isEnabled ? "enabled" : "disabled"}
            onChange={(event) => {
              onDraftChange({
                ...draft,
                isEnabled: event.target.value === "enabled",
                confirmDestructive: false,
              });
            }}
            disabled={pending}
          >
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>

        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Condition address</span>
          <input
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            type="text"
            value={draft.conditionAddress}
            onChange={(event) => {
              onDraftChange({ ...draft, conditionAddress: event.target.value });
            }}
            disabled={pending}
          />
          {errors.conditionAddress ? (
            <p className="text-xs text-red-200">{errors.conditionAddress}</p>
          ) : null}
        </label>

        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Condition operator</span>
          <input
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            type="text"
            value={draft.conditionOperator}
            onChange={(event) => {
              onDraftChange({ ...draft, conditionOperator: event.target.value });
            }}
            disabled={pending}
          />
          {errors.conditionOperator ? (
            <p className="text-xs text-red-200">{errors.conditionOperator}</p>
          ) : null}
        </label>

        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Condition value</span>
          <input
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            type="text"
            value={draft.conditionValue}
            onChange={(event) => {
              onDraftChange({ ...draft, conditionValue: event.target.value });
            }}
            disabled={pending}
          />
          {errors.conditionValue ? (
            <p className="text-xs text-red-200">{errors.conditionValue}</p>
          ) : null}
        </label>

        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Action address</span>
          <input
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            type="text"
            value={draft.actionAddress}
            onChange={(event) => {
              onDraftChange({ ...draft, actionAddress: event.target.value });
            }}
            disabled={pending}
          />
          {errors.actionAddress ? (
            <p className="text-xs text-red-200">{errors.actionAddress}</p>
          ) : null}
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-[200px_1fr]">
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Action method</span>
          <select
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            value={draft.actionMethod}
            onChange={(event) => {
              onDraftChange({
                ...draft,
                actionMethod: event.target.value as typeof draft.actionMethod,
                explicitDangerousToken: "",
              });
            }}
            disabled={pending}
          >
            <option value="PUT">PUT</option>
            <option value="POST">POST</option>
            <option value="DELETE">DELETE</option>
          </select>
        </label>

        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Action body (JSON object)</span>
          <textarea
            className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            value={draft.actionBodyText}
            onChange={(event) => {
              onDraftChange({ ...draft, actionBodyText: event.target.value });
            }}
            disabled={pending}
          />
          {errors.actionBodyText ? (
            <p className="text-xs text-red-200">{errors.actionBodyText}</p>
          ) : null}
        </label>
      </div>

      {requiredSafetyAction === "confirm" ? (
        <label className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-950/20 p-2 text-xs text-amber-100">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={draft.confirmDestructive}
            onChange={(event) => {
              onDraftChange({ ...draft, confirmDestructive: event.target.checked });
            }}
            disabled={pending}
          />
          <span>
            Destructive write detected. Confirm before save.
            {errors.confirmDestructive ? (
              <span className="ml-1 text-red-200">{errors.confirmDestructive}</span>
            ) : null}
          </span>
        </label>
      ) : null}

      {requiredSafetyAction === "explicit" ? (
        <label className="space-y-1 rounded-md border border-red-500/40 bg-red-950/20 p-2 text-xs text-red-100">
          <span>
            Dangerous write detected. Type{" "}
            <span className="font-semibold">{DANGEROUS_AUTOMATION_MUTATION_TOKEN}</span> to
            continue.
          </span>
          <input
            className="h-8 w-full rounded-md border border-red-500/40 bg-background px-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            type="text"
            value={draft.explicitDangerousToken}
            onChange={(event) => {
              onDraftChange({ ...draft, explicitDangerousToken: event.target.value });
            }}
            disabled={pending}
          />
          {errors.explicitDangerousToken ? (
            <p className="text-xs text-red-200">{errors.explicitDangerousToken}</p>
          ) : null}
        </label>
      ) : null}

      <button
        type="submit"
        className="h-9 rounded-md border border-border px-3 text-xs font-medium text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
      >
        {pending
          ? mode === "create"
            ? "Creating..."
            : "Saving..."
          : mode === "create"
            ? "Create automation"
            : "Save automation"}
      </button>
    </form>
  );
}
