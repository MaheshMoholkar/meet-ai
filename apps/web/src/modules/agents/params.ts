import { createLoader, parseAsInteger, parseAsString } from "nuqs/server";

import { DEFAULT_PAGE } from "@/constants";

// Shared by the server loader and the client hook, so prefetch and client query keys match.
export const agentsFilterParsers = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  page: parseAsInteger.withDefault(DEFAULT_PAGE).withOptions({ clearOnDefault: true }),
};

export const loadAgentsFilters = createLoader(agentsFilterParsers);
