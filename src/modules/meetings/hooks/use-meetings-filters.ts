import { useQueryStates } from "nuqs";

import { meetingsFilterParsers } from "../params";

export const useMeetingsFilters = () => useQueryStates(meetingsFilterParsers);
