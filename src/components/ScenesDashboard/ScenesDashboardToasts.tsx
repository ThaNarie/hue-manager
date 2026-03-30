import type { SceneFeedbackToast } from "./ScenesDashboard.types";

type ScenesDashboardToastsProps = {
  toasts: SceneFeedbackToast[];
  onDismissToast: (toastId: string) => void;
};

export function ScenesDashboardToasts({ toasts, onDismissToast }: ScenesDashboardToastsProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={
            toast.tone === "success"
              ? "rounded-md border border-emerald-500/40 bg-emerald-950/95 px-3 py-2 text-sm text-emerald-100 shadow-lg"
              : "rounded-md border border-red-500/40 bg-red-950/95 px-3 py-2 text-sm text-red-100 shadow-lg"
          }
        >
          <div className="flex items-start justify-between gap-2">
            <p>{toast.message}</p>
            <button
              type="button"
              className="shrink-0 text-xs font-medium transition hover:text-slate-100"
              onClick={() => {
                onDismissToast(toast.id);
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
