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

export type HueV1Scene = {
  name?: string;
  group?: string;
  locked?: boolean;
  lastupdated?: string;
};

export type HueV1ScenesResponse = Record<string, HueV1Scene>;

export type HueV1MutationResult = {
  success?: Record<string, unknown>;
  error?: {
    type?: number;
    address?: string;
    description?: string;
  };
};
