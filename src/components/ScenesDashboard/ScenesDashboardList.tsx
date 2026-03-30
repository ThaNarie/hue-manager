import { useState } from "react";
import type { Scene } from "../../../shared/contracts/scenes";
import { DELETE_CONFIRMATION_TEXT } from "./ScenesDashboard.types";

type ScenesDashboardListProps = {
  scenes: Scene[];
  pendingSceneIds: string[];
  writesDisabled: boolean;
  onActivateScene: (sceneId: string) => void;
  onEditScene: (sceneId: string, name: string) => void;
  onDeleteScene: (sceneId: string) => void;
};

export function ScenesDashboardList({
  scenes,
  pendingSceneIds,
  writesDisabled,
  onActivateScene,
  onEditScene,
  onDeleteScene,
}: ScenesDashboardListProps) {
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmDeleteSceneId, setConfirmDeleteSceneId] = useState<string | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");

  return (
    <ul className="space-y-2">
      {scenes.map((scene) => {
        const isPending = writesDisabled || pendingSceneIds.includes(scene.id);
        const isEditing = editingSceneId === scene.id;
        const isConfirmingDelete = confirmDeleteSceneId === scene.id;

        return (
          <li key={scene.id} className="rounded-md border border-border/70 bg-card/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{scene.name}</p>
                <p className="text-xs text-muted-foreground">
                  ID: {scene.id} · Last updated: {new Date(scene.lastUpdatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-md border border-border px-2 py-1 text-xs font-medium text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    onActivateScene(scene.id);
                  }}
                  disabled={isPending}
                >
                  Activate
                </button>
                <button
                  type="button"
                  className="rounded-md border border-border px-2 py-1 text-xs font-medium text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    setEditingSceneId(scene.id);
                    setEditingName(scene.name);
                  }}
                  disabled={isPending}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="rounded-md border border-red-500/40 px-2 py-1 text-xs font-medium text-red-200 transition hover:border-red-400 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    setConfirmDeleteSceneId(scene.id);
                    setDeleteConfirmationInput("");
                  }}
                  disabled={isPending}
                >
                  Delete
                </button>
              </div>
            </div>

            {isEditing ? (
              <form
                className="mt-3 flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  onEditScene(scene.id, editingName);
                  setEditingSceneId(null);
                }}
              >
                <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs text-muted-foreground">
                  Edit scene name
                  <input
                    className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                    type="text"
                    maxLength={32}
                    value={editingName}
                    onChange={(event) => {
                      setEditingName(event.target.value);
                    }}
                    disabled={isPending}
                  />
                </label>
                <button
                  type="submit"
                  className="h-8 rounded-md border border-border px-2 text-xs font-medium text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPending || editingName.trim().length === 0}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="h-8 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                  onClick={() => {
                    setEditingSceneId(null);
                  }}
                  disabled={isPending}
                >
                  Cancel
                </button>
              </form>
            ) : null}

            {isConfirmingDelete ? (
              <div className="mt-3 rounded-md border border-red-500/40 bg-red-950/20 p-3">
                <p className="text-xs text-red-100">
                  Destructive action. Type{" "}
                  <span className="font-semibold">{DELETE_CONFIRMATION_TEXT}</span> to confirm
                  deletion.
                </p>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <input
                    className="h-8 min-w-48 flex-1 rounded-md border border-red-500/40 bg-background px-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                    type="text"
                    value={deleteConfirmationInput}
                    onChange={(event) => {
                      setDeleteConfirmationInput(event.target.value);
                    }}
                    disabled={isPending}
                  />
                  <button
                    type="button"
                    className="h-8 rounded-md border border-red-500/40 px-2 text-xs font-medium text-red-100 transition hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      onDeleteScene(scene.id);
                      setConfirmDeleteSceneId(null);
                    }}
                    disabled={isPending || deleteConfirmationInput !== DELETE_CONFIRMATION_TEXT}
                  >
                    Confirm delete
                  </button>
                  <button
                    type="button"
                    className="h-8 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                    onClick={() => {
                      setConfirmDeleteSceneId(null);
                    }}
                    disabled={isPending}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
