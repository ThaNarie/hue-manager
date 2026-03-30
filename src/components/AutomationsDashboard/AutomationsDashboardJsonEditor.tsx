import { DANGEROUS_AUTOMATION_MUTATION_TOKEN } from "../../../shared/safety/automationMutationSafetyPolicy";
import type { AutomationJsonDraft, AutomationJsonDraftErrors } from "./AutomationsDashboard.types";

type AutomationsDashboardJsonEditorProps = {
  draft: AutomationJsonDraft;
  errors: AutomationJsonDraftErrors;
  pending: boolean;
  requiredSafetyAction: "immediate" | "confirm" | "explicit";
  apiError: string | null;
  onDraftChange: (nextDraft: AutomationJsonDraft) => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
};

export function AutomationsDashboardJsonEditor({
  draft,
  errors,
  pending,
  requiredSafetyAction,
  apiError,
  onDraftChange,
  onSubmit,
  onCancelEdit,
}: AutomationsDashboardJsonEditorProps) {
  return (
    <form
      className="space-y-3 rounded-md border border-border/70 bg-card/60 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Edit automation (advanced JSON)</p>
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
          onClick={onCancelEdit}
          disabled={pending}
        >
          Cancel edit
        </button>
      </div>

      <label className="block space-y-1 text-xs text-muted-foreground">
        <span>Mutation payload (JSON)</span>
        <textarea
          className="min-h-44 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          value={draft.payloadText}
          onChange={(event) => {
            onDraftChange({
              ...draft,
              payloadText: event.target.value,
            });
          }}
          disabled={pending}
        />
        {errors.payloadText ? <p className="text-xs text-red-200">{errors.payloadText}</p> : null}
      </label>

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

      {apiError ? (
        <p className="rounded-md border border-red-500/40 bg-red-950/20 px-3 py-2 text-xs text-red-200">
          Save failed: {apiError}
        </p>
      ) : null}

      <button
        type="submit"
        className="h-9 rounded-md border border-border px-3 text-xs font-medium text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
      >
        {pending ? "Saving..." : "Save JSON payload"}
      </button>
    </form>
  );
}
