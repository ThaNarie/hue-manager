import type { SceneDraft } from "./ScenesDashboard.types";

type ScenesDashboardFormProps = {
  draft: SceneDraft;
  disabled: boolean;
  onDraftChange: (nextDraft: SceneDraft) => void;
  onCreateScene: () => void;
};

export function ScenesDashboardForm({
  draft,
  disabled,
  onDraftChange,
  onCreateScene,
}: ScenesDashboardFormProps) {
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onCreateScene();
      }}
    >
      <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs text-muted-foreground">
        Scene name
        <input
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          type="text"
          maxLength={32}
          value={draft.name}
          placeholder="e.g. Movie Night"
          onChange={(event) => {
            onDraftChange({ ...draft, name: event.target.value });
          }}
          disabled={disabled}
        />
      </label>
      <button
        className="h-9 rounded-md border border-border px-3 text-xs font-medium text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={disabled || draft.name.trim().length === 0}
      >
        {disabled ? "Creating..." : "Create scene"}
      </button>
    </form>
  );
}
