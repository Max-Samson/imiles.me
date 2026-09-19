import { ValidationError } from '../errors';
import type { ListQuery, SortField } from '../types';

export type { SortField } from '../types';
export type RestQueryParams = ListQuery;

export interface ParseRestQueryOptions {
  defaultPage?: number;
  defaultPageSize?: number;
  maxPageSize?: number;
  maxOffset?: number;
  allowedSortFields?: readonly string[];
  allowedFilterFields?: readonly string[];
  allowedFields?: readonly string[];
  defaultSort?: SortField[];
}

function positiveInteger(value: string | null, fallback: number, field: string): number {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    throw new ValidationError(`${field} 必须是正整数`);
  }
  return Number(value);
}

function assertAllowed(field: string, allowed: readonly string[], kind: string): void {
  if (!allowed.includes(field) || ['__proto__', 'constructor', 'prototype'].includes(field)) {
    throw new ValidationError(`不支持的${kind}: ${field}`);
  }
}

/** 只解析页码分页；字段默认拒绝，路由必须显式提供业务白名单。 */
export function parseRestQuery(
  input: URL | URLSearchParams | string,
  options: ParseRestQueryOptions = {},
): RestQueryParams {
  const {
    defaultPage = 1,
    defaultPageSize = 20,
    maxPageSize = 100,
    maxOffset = 100_000,
    allowedSortFields = ['createdAt'],
    allowedFilterFields = [],
    allowedFields = [],
    defaultSort = [{ field: 'createdAt', direction: 'desc' }],
  } = options;
  if (
    [defaultPage, defaultPageSize, maxPageSize].some((n) => !Number.isSafeInteger(n) || n < 1) ||
    !Number.isSafeInteger(maxOffset) ||
    maxOffset < 0 ||
    defaultPageSize > maxPageSize
  ) {
    throw new TypeError('Invalid pagination configuration');
  }
  if (
    defaultSort.some(
      (s) => !allowedSortFields.includes(s.field) || !['asc', 'desc'].includes(s.direction),
    )
  ) {
    throw new TypeError('defaultSort must use allowedSortFields');
  }
  const params =
    typeof input === 'string'
      ? input.includes('?') || /^https?:\/\//.test(input)
        ? new URL(input, 'https://localhost').searchParams
        : new URLSearchParams(input)
      : input instanceof URL
        ? input.searchParams
        : input;
  const seen = new Set<string>();
  for (const [key] of params) {
    if (seen.has(key)) throw new ValidationError(`参数不能重复: ${key}`);
    seen.add(key);
  }
  if (params.has('cursor') || params.has('offset')) {
    throw new ValidationError('此接口仅支持 page/pageSize 分页');
  }
  if (params.has('pageSize') && params.has('limit')) {
    throw new ValidationError('pageSize 与 limit 不能同时使用');
  }
  const page = positiveInteger(params.get('page'), defaultPage, 'page');
  const pageSize = Math.min(
    positiveInteger(params.get('pageSize') ?? params.get('limit'), defaultPageSize, 'pageSize'),
    maxPageSize,
  );
  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset) || offset > maxOffset) {
    throw new ValidationError('分页偏移量超出允许范围');
  }
  const rawSort = params.get('sort');
  const sort: SortField[] =
    rawSort === null
      ? defaultSort.map((s) => ({ ...s }))
      : rawSort.split(',').map((part) => {
          const match = /^([+-]?)([a-zA-Z_][\w]*)(?::(asc|desc))?$/.exec(part.trim());
          if (!match || (match[1] && match[3])) throw new ValidationError('排序格式无效');
          const [, prefix, field, direction] = match;
          assertAllowed(field, allowedSortFields, '排序字段');
          return { field, direction: prefix === '-' || direction === 'desc' ? 'desc' : 'asc' };
        });
  const fields = params.has('fields')
    ? [
        ...new Set(
          params
            .get('fields')
            ?.split(',')
            .map((f) => {
              const field = f.trim();
              assertAllowed(field, allowedFields, '返回字段');
              return field;
            }),
        ),
      ]
    : undefined;
  const search = params.get('q')?.trim() || undefined;
  if (search && search.length > 200) throw new ValidationError('搜索词过长');
  const filters: Record<string, string> = {};
  const standardKeys = new Set(['page', 'pageSize', 'limit', 'sort', 'q', 'fields']);
  for (const [key, value] of params) {
    if (standardKeys.has(key)) continue;
    const field = /^filter\[([^\]]+)\]$/.exec(key)?.[1] ?? key;
    assertAllowed(field, allowedFilterFields, '过滤字段');
    if (Object.hasOwn(filters, field)) throw new ValidationError(`过滤字段不能重复: ${field}`);
    if (value.length > 1000) throw new ValidationError('过滤值过长');
    filters[field] = value.trim();
  }
  return { page, pageSize, offset, limit: pageSize, sort, search, filters, fields };
}
