import type { Light } from "../../../shared/contracts/lights";
import type { LightMutationRequest } from "../../../shared/contracts/lights";
import type { LightMutationSafetyApproval } from "../../../shared/safety/lightMutationSafetyPolicy";

export const UNASSIGNED_ZONE_FILTER = "__unassigned__";

export type LightSortOption =
  | "name-asc"
  | "name-desc"
  | "brightness-desc"
  | "brightness-asc"
  | "updated-desc"
  | "updated-asc";

export type LightFilters = {
  searchQuery: string;
  roomId: string;
  zoneId: string;
  sort: LightSortOption;
};

export type SavedLightView = {
  name: string;
  filters: LightFilters;
};

export type LightFilterOption = {
  value: string;
  label: string;
};

export type LightsDashboardData = {
  lights: Light[];
  filteredLights: Light[];
  roomOptions: LightFilterOption[];
  zoneOptions: LightFilterOption[];
};

export type LightMutationInput = {
  lightId: string;
  patch: LightMutationRequest;
  approval: LightMutationSafetyApproval | null;
};

export type LightControlErrorMap = Record<string, string>;

export type DashboardToast = {
  id: string;
  message: string;
};
