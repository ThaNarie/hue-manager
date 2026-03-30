export type HueV1LightState = {
  on?: boolean;
  bri?: number;
  lastupdated?: string;
};

export type HueV1Light = {
  name?: string;
  type?: string;
  state?: HueV1LightState;
};

export type HueV1LightsResponse = Record<string, HueV1Light>;

export type HueV1Group = {
  type?: string;
  name?: string;
  lights?: string[];
};

export type HueV1GroupsResponse = Record<string, HueV1Group>;

export type HueV1MutationResult = {
  success?: Record<string, unknown>;
  error?: {
    type?: number;
    address?: string;
    description?: string;
  };
};

export type HueV1Rule = {
  name?: string;
  status?: "enabled" | "disabled";
  owner?: string;
  lasttriggered?: string;
};

export type HueV1RulesResponse = Record<string, HueV1Rule>;
