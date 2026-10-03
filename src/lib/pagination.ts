import { z } from "zod";

import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@/constants";

export const paginationInput = {
  page: z.number().int().min(1).default(DEFAULT_PAGE),
  pageSize: z.number().int().min(MIN_PAGE_SIZE).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(100).nullish(),
};

export function pageOffset(page: number, pageSize: number) {
  return (page - 1) * pageSize;
}

export function totalPages(total: number, pageSize: number) {
  return Math.ceil(total / pageSize);
}

/** Builds an ILIKE "contains" pattern, escaping the user's own % _ and \ characters. */
export function containsPattern(search: string) {
  return `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
