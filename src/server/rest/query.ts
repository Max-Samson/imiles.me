import type { PaginationParams } from '../types';

export interface SortField {
  field: string;
  direction: 'asc' | 'desc';
}

export interface RestQueryParams extends PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
  sort: SortField[];
  search?: string;
  filters: Record<string, string>;
  fields?: string[];
}

export interface ParseRestQueryOptions {
  defaultPage?: number;
  defaultPageSize?: number;
  maxPageSize?: number;
  allowedSortFields?: string[];
  defaultSort?: SortField[];
}

/**
 * Parses and sanitizes RESTful query parameters from a URL or search params
 * Handles pagination (?page=1&pageSize=20), sorting (?sort=-created_at,views),
 * filtering, search (?q=keyword), and field selection (?fields=id,title)
 */
export function parseRestQuery(
  input: URL | URLSearchParams | string,
  options: ParseRestQueryOptions = {},
): RestQueryParams {
  const {
    defaultPage = 1,
    defaultPageSize = 20,
    maxPageSize = 100,
    allowedSortFields,
    defaultSort = [{ field: 'createdAt', direction: 'desc' }],
  } = options;

  let searchParams: URLSearchParams;
  if (typeof input === 'string') {
    searchParams = input.includes('?')
      ? new URL(input, 'https://localhost').searchParams
      : new URLSearchParams(input);
  } else if (input instanceof URL) {
    searchParams = input.searchParams;
  } else {
    searchParams = input;
  }

  // 1. Pagination
  const rawPage = Number.parseInt(searchParams.get('page') ?? '', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : defaultPage;

  const rawPageSize = Number.parseInt(
    searchParams.get('pageSize') ?? searchParams.get('limit') ?? '',
    10,
  );
  let pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? rawPageSize : defaultPageSize;
  if (pageSize > maxPageSize) {
    pageSize = maxPageSize;
  }

  const offset = (page - 1) * pageSize;
  const limit = pageSize;

  // 2. Sorting (?sort=-created_at,views or ?sort=views:desc)
  const rawSort = searchParams.get('sort');
  let sort: SortField[] = [];

  if (rawSort) {
    const parts = rawSort.split(',').map((p) => p.trim());
    for (const part of parts) {
      if (!part) continue;
      let field: string;
      let direction: 'asc' | 'desc' = 'asc';

      if (part.startsWith('-')) {
        direction = 'desc';
        field = part.slice(1);
      } else if (part.startsWith('+')) {
        direction = 'asc';
        field = part.slice(1);
      } else if (part.includes(':')) {
        const [f, d] = part.split(':');
        field = f;
        direction = d?.toLowerCase() === 'desc' ? 'desc' : 'asc';
      } else {
        field = part;
      }

      if (allowedSortFields && !allowedSortFields.includes(field)) {
        continue;
      }

      sort.push({ field, direction });
    }
  }

  if (sort.length === 0) {
    sort = defaultSort;
  }

  // 3. Search query (?q=...)
  const search = searchParams.get('q')?.trim() || undefined;

  // 4. Sparse Fieldsets (?fields=id,title,views)
  const rawFields = searchParams.get('fields');
  const fields = rawFields
    ? rawFields
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean)
    : undefined;

  // 5. Remaining filters (filter[key]=val or custom params)
  const filters: Record<string, string> = {};
  const standardKeys: Record<string, true> = {
    page: true,
    pageSize: true,
    limit: true,
    offset: true,
    sort: true,
    q: true,
    fields: true,
    cursor: true,
  };

  for (const [key, value] of searchParams.entries()) {
    if (standardKeys[key]) continue;

    // Handle filter[category]=tech style
    const bracketMatch = key.match(/^filter\[(.*)\]$/);
    if (bracketMatch?.[1]) {
      filters[bracketMatch[1]] = value.trim();
    } else {
      filters[key] = value.trim();
    }
  }

  return {
    page,
    pageSize,
    offset,
    limit,
    sort,
    search,
    filters,
    fields,
    cursor: searchParams.get('cursor') || undefined,
  };
}
