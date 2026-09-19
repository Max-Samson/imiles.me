/** 与 HTTP 无关的查询契约；业务仓储可扩展或使用自己的 DTO。 */
export interface SortField {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ListQuery {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
  sort: SortField[];
  search?: string;
  filters: Record<string, string>;
  fields?: string[];
}
