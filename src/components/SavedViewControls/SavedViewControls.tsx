type SavedViewControlsProps = {
  title: string;
  saveLabel: string;
  namePlaceholder: string;
  savedViews: string[];
  draftName: string;
  selectedViewName: string;
  onDraftNameChange: (value: string) => void;
  onSelectedViewNameChange: (value: string) => void;
  onSave: () => void;
  onApply: () => void;
  onDelete: () => void;
};

export function SavedViewControls({
  title,
  saveLabel,
  namePlaceholder,
  savedViews,
  draftName,
  selectedViewName,
  onDraftNameChange,
  onSelectedViewNameChange,
  onSave,
  onApply,
  onDelete,
}: SavedViewControlsProps) {
  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-slate-900/40 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-56 flex-1 space-y-1 text-xs text-muted-foreground">
          <span>View name</span>
          <input
            type="text"
            value={draftName}
            onChange={(event) => {
              onDraftNameChange(event.target.value);
            }}
            placeholder={namePlaceholder}
            className="h-8 w-full rounded-md border border-border bg-slate-900/70 px-2 text-sm text-slate-100 outline-none transition focus-visible:border-slate-500"
          />
        </label>
        <button
          type="button"
          onClick={onSave}
          className="h-8 rounded-md border border-border px-3 text-xs font-medium text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={draftName.trim().length === 0}
        >
          {saveLabel}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-56 flex-1 space-y-1 text-xs text-muted-foreground">
          <span>Saved views</span>
          <select
            value={selectedViewName}
            onChange={(event) => {
              onSelectedViewNameChange(event.target.value);
            }}
            className="h-8 w-full rounded-md border border-border bg-slate-900/70 px-2 text-sm text-slate-100 outline-none transition focus-visible:border-slate-500"
          >
            <option value="">Select a saved view</option>
            {savedViews.map((viewName) => (
              <option key={viewName} value={viewName}>
                {viewName}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onApply}
          className="h-8 rounded-md border border-border px-3 text-xs font-medium text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={selectedViewName.length === 0}
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="h-8 rounded-md border border-red-500/40 px-3 text-xs font-medium text-red-200 transition hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={selectedViewName.length === 0}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
