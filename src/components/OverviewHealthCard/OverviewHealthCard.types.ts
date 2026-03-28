import type { OverviewHealthResponse } from "../../../shared/contracts/health";

export type OverviewHealthCardState =
  | { status: "loading" }
  | { status: "ready"; data: OverviewHealthResponse }
  | { status: "error"; message: string };
