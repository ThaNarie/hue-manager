export type RalphLabelConfig = {
  name: string;
  color: string;
  description: string;
};

export type RalphConfig = {
  repo: string;
  loopIntervalMs: number;
  baseBranch: string;
  workerImage: string;
  workerTimeoutMs: number;
  requiredLabels: RalphLabelConfig[];
};

export type RalphSecrets = {
  GITHUB_TOKEN: string;
  CURSOR_API_KEY: string;
};
