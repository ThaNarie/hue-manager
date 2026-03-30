import { useMemo, useState } from "react";
import type { AutomationMutationSafetyAction } from "../../../shared/safety/automationMutationSafetyPolicy";
import {
  DANGEROUS_AUTOMATION_MUTATION_TOKEN,
  getAutomationMutationSafetyAction,
} from "../../../shared/safety/automationMutationSafetyPolicy";
import type { Automation } from "../../../shared/contracts/automations";
import type {
  AutomationEditorVariant,
  AutomationGuidedDraftErrors,
  AutomationJsonDraftErrors,
} from "./AutomationsDashboard.types";
import {
  getGuidedDraftFromAutomation,
  getInitialAutomationGuidedDraft,
  getInitialAutomationJsonDraft,
  getJsonDraftFromAutomation,
  validateAutomationGuidedDraft,
  validateAutomationJsonDraft,
} from "./AutomationsDashboard.utils";

function getApproval(requiredAction: AutomationMutationSafetyAction, explicitToken?: string) {
  if (requiredAction === "immediate") {
    return null;
  }
  if (requiredAction === "confirm") {
    return { action: "confirm" as const };
  }
  return {
    action: "explicit" as const,
    token: explicitToken?.trim() ?? "",
  };
}

export function useAutomationsDashboardEditorState() {
  const [editorVariant, setEditorVariant] = useState<AutomationEditorVariant>("guided");
  const [guidedMode, setGuidedMode] = useState<"create" | "edit">("create");
  const [editingAutomationId, setEditingAutomationId] = useState<string | null>(null);
  const [guidedDraft, setGuidedDraftState] = useState(getInitialAutomationGuidedDraft);
  const [guidedDraftErrors, setGuidedDraftErrors] = useState<AutomationGuidedDraftErrors>({});
  const [jsonDraft, setJsonDraftState] = useState(getInitialAutomationJsonDraft);
  const [jsonDraftErrors, setJsonDraftErrors] = useState<AutomationJsonDraftErrors>({});
  const [jsonApiError, setJsonApiError] = useState<string | null>(null);

  function resetEditorState() {
    setEditorVariant("guided");
    setGuidedMode("create");
    setEditingAutomationId(null);
    setGuidedDraftState(getInitialAutomationGuidedDraft());
    setGuidedDraftErrors({});
    setJsonDraftState(getInitialAutomationJsonDraft());
    setJsonDraftErrors({});
    setJsonApiError(null);
  }

  function setGuidedDraft(nextDraft: typeof guidedDraft) {
    setGuidedDraftState(nextDraft);
    setGuidedDraftErrors({});
  }

  function setJsonDraft(nextDraft: typeof jsonDraft) {
    setJsonDraftState(nextDraft);
    setJsonDraftErrors({});
    setJsonApiError(null);
  }

  function startGuidedEdit(automation: Automation) {
    setEditorVariant("guided");
    setGuidedMode("edit");
    setEditingAutomationId(automation.id);
    setGuidedDraftState(getGuidedDraftFromAutomation(automation));
    setGuidedDraftErrors({});
  }

  function startJsonEdit(automation: Automation) {
    setEditorVariant("json");
    setGuidedMode("edit");
    setEditingAutomationId(automation.id);
    setJsonDraftState(getJsonDraftFromAutomation(automation));
    setJsonDraftErrors({});
    setJsonApiError(null);
  }

  function getGuidedMutationPlan() {
    const validation = validateAutomationGuidedDraft(guidedDraft);
    const nextErrors: AutomationGuidedDraftErrors = { ...validation.errors };
    if (!validation.actionBody) {
      setGuidedDraftErrors(nextErrors);
      return null;
    }

    const payload = {
      name: guidedDraft.name.trim(),
      isEnabled: guidedDraft.isEnabled,
      conditions: [
        {
          address: guidedDraft.conditionAddress.trim(),
          operator: guidedDraft.conditionOperator.trim(),
          value: guidedDraft.conditionValue.trim(),
        },
      ],
      actions: [
        {
          address: guidedDraft.actionAddress.trim(),
          method: guidedDraft.actionMethod,
          body: validation.actionBody,
        },
      ],
    };
    const requiredAction = getAutomationMutationSafetyAction(payload);
    if (requiredAction === "confirm" && !guidedDraft.confirmDestructive) {
      nextErrors.confirmDestructive = "Required for this write.";
    }
    if (
      requiredAction === "explicit" &&
      guidedDraft.explicitDangerousToken.trim() !== DANGEROUS_AUTOMATION_MUTATION_TOKEN
    ) {
      nextErrors.explicitDangerousToken = "Dangerous confirmation token does not match.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setGuidedDraftErrors(nextErrors);
      return null;
    }
    setGuidedDraftErrors({});
    return {
      payload,
      approval: getApproval(requiredAction, guidedDraft.explicitDangerousToken),
    };
  }

  function getJsonMutationPlan() {
    const validation = validateAutomationJsonDraft(jsonDraft);
    const nextErrors: AutomationJsonDraftErrors = { ...validation.errors };
    if (!validation.payload) {
      setJsonDraftErrors(nextErrors);
      return null;
    }
    const requiredAction = getAutomationMutationSafetyAction(validation.payload);
    if (requiredAction === "confirm" && !jsonDraft.confirmDestructive) {
      nextErrors.confirmDestructive = "Required for this write.";
    }
    if (
      requiredAction === "explicit" &&
      jsonDraft.explicitDangerousToken.trim() !== DANGEROUS_AUTOMATION_MUTATION_TOKEN
    ) {
      nextErrors.explicitDangerousToken = "Dangerous confirmation token does not match.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setJsonDraftErrors(nextErrors);
      return null;
    }
    setJsonDraftErrors({});
    setJsonApiError(null);
    return {
      payload: validation.payload,
      approval: getApproval(requiredAction, jsonDraft.explicitDangerousToken),
    };
  }

  const requiredGuidedSafetyAction = useMemo(() => {
    const validation = validateAutomationGuidedDraft(guidedDraft);
    if (!validation.actionBody) {
      return "immediate";
    }
    return getAutomationMutationSafetyAction({
      name: guidedDraft.name.trim(),
      isEnabled: guidedDraft.isEnabled,
      conditions: [
        {
          address: guidedDraft.conditionAddress.trim(),
          operator: guidedDraft.conditionOperator.trim(),
          value: guidedDraft.conditionValue.trim(),
        },
      ],
      actions: [
        {
          address: guidedDraft.actionAddress.trim(),
          method: guidedDraft.actionMethod,
          body: validation.actionBody,
        },
      ],
    });
  }, [guidedDraft]);

  const requiredJsonSafetyAction = useMemo(() => {
    const validation = validateAutomationJsonDraft(jsonDraft);
    return validation.payload ? getAutomationMutationSafetyAction(validation.payload) : "immediate";
  }, [jsonDraft]);

  return {
    editorVariant,
    editingAutomationId,
    getGuidedMutationPlan,
    getJsonMutationPlan,
    guidedDraft,
    guidedDraftErrors,
    guidedMode,
    jsonApiError,
    jsonDraft,
    jsonDraftErrors,
    requiredGuidedSafetyAction,
    requiredJsonSafetyAction,
    resetEditorState,
    setEditorVariant,
    setGuidedDraft,
    setJsonApiError,
    setJsonDraft,
    startGuidedEdit,
    startJsonEdit,
  };
}
