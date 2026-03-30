import { useState } from "react";
import type { LightFilters, SavedLightView } from "./LightsDashboard.types";
import {
  LIGHT_SAVED_VIEWS_STORAGE_KEY,
  parseSavedLightViews,
  removeSavedLightView,
  upsertSavedLightView,
} from "./LightsDashboard.utils";

export function useLightSavedViews(
  filters: LightFilters,
  setFilters: (nextFilters: LightFilters) => void,
) {
  const [savedViews, setSavedViews] = useState<SavedLightView[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    return parseSavedLightViews(window.localStorage.getItem(LIGHT_SAVED_VIEWS_STORAGE_KEY));
  });
  const [savedViewDraftName, setSavedViewDraftName] = useState("");
  const [selectedSavedViewName, setSelectedSavedViewName] = useState("");

  function persistSavedViews(nextViews: SavedLightView[]) {
    setSavedViews(nextViews);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LIGHT_SAVED_VIEWS_STORAGE_KEY, JSON.stringify(nextViews));
    }
  }

  function saveCurrentView() {
    const nextName = savedViewDraftName.trim();
    if (!nextName) {
      return;
    }

    const nextViews = upsertSavedLightView(savedViews, { name: nextName, filters });
    persistSavedViews(nextViews);
    setSavedViewDraftName("");
    setSelectedSavedViewName(nextName);
  }

  function applySelectedSavedView() {
    if (!selectedSavedViewName) {
      return;
    }
    const selectedView = savedViews.find((view) => view.name === selectedSavedViewName);
    if (!selectedView) {
      return;
    }
    setFilters({ ...selectedView.filters });
  }

  function deleteSelectedSavedView() {
    if (!selectedSavedViewName) {
      return;
    }
    const nextViews = removeSavedLightView(savedViews, selectedSavedViewName);
    persistSavedViews(nextViews);
    setSelectedSavedViewName("");
  }

  return {
    applySelectedSavedView,
    deleteSelectedSavedView,
    saveCurrentView,
    savedViewDraftName,
    savedViews,
    selectedSavedViewName,
    setSavedViewDraftName,
    setSelectedSavedViewName,
  };
}
