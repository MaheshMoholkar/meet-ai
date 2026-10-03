import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { DEFAULT_PAGE } from "@/constants";

import { MEETING_STATUSES } from "./schemas";

// Shared by the server loader and the client hook, so prefetch and client query keys match.
export const meetingsFilterParsers = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  page: parseAsInteger.withDefault(DEFAULT_PAGE).withOptions({ clearOnDefault: true }),
  status: parseAsStringLiteral(MEETING_STATUSES),
  agentId: parseAsString,
};

export const loadMeetingsFilters = createLoader(meetingsFilterParsers);
