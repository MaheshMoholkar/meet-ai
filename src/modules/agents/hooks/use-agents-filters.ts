import { useQueryStates } from "nuqs";

import { agentsFilterParsers } from "../params";

export const useAgentsFilters = () => useQueryStates(agentsFilterParsers);
