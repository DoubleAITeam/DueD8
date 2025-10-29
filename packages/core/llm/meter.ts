import type { Usage } from "./types";
import type { ProviderId } from "./router";

type Meter = {
  commit: (usage: Usage, provider: ProviderId) => void;
};

function commit(usage: Usage, provider: ProviderId) {
  void usage;
  void provider;
  // Placeholder for telemetry integration.
}

export const meter: Meter = { commit };
