
import React, { useMemo } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { CollectionTemplate, TemplateField } from '../features/collections';
import { useI18n } from '../i18n/I18nContext';

interface PostData {
  frontmatter: Record<string, any>;
  [key: string]: any;
}

export interface FilterValue {
  type: TemplateField['type'];
  value: any;
}

interface FilterBarProps {
  template: CollectionTemplate | null;
  posts: PostData[];
  activeFilters: Record<string, FilterValue>;
  onFilterChange: (field: string, filter: FilterValue | null) => void;
  onClearFilters: () => void;
}

// Extract unique values for a field from all posts
const getUniqueValues = (posts: PostData[], field: string): string[] => {
  const values = new Set<string>();
  posts.forEach(post => {
    const val = post.frontmatter[field];
    if (val !== undefined && val !== null && val !== '') {
      if (Array.isArray(val)) {
        val.forEach(v => values.add(String(v)));
      } else if (typeof val !== 'object') {
        values.add(String(val));
      }
    }
  });
  return Array.from(values).sort();
};

// Get min/max for numeric fields
const getNumberRange = (posts: PostData[], field: string): { min: number; max: number } => {
  let min = Infinity;
  let max = -Infinity;
  posts.forEach(post => {
    const val = Number(post.frontmatter[field]);
    if (!isNaN(val)) {
      if (val < min) min = val;
      if (val > max) max = val;
    }
  });
  return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 100 : max };
};

// Get min/max for date fields
const getDateRange = (posts: PostData[], field: string): { min: string; max: string } => {
  let min = '';
  let max = '';
  posts.forEach(post => {
    const val = post.frontmatter[field];
    if (val) {
      const d = val instanceof Date ? val : new Date(val);
      if (!isNaN(d.getTime())) {
        const iso = d.toISOString().split('T')[0];
        if (!min || iso < min) min = iso;
        if (!max || iso > max) max = iso;
      }
    }
  });
  return { min, max };
};


/**
 * FilterBar: Renders type-aware filter controls based on collection template
 */
const FilterBar: React.FC<FilterBarProps> = ({
  template,
  posts,
  activeFilters,
  onFilterChange,
  onClearFilters,
}) => {
  const { t } = useI18n();

  // Only show filterable fields (exclude object type and commonly fixed fields)
  const filterableFields = useMemo(() => {
    if (!template?.fields) return [];
    return template.fields.filter(
      f => f.type !== 'object' && !['title', 'image', 'cover', 'thumbnail', 'heroImage'].includes(f.name)
    );
  }, [template]);

  const activeFilterCount = Object.keys(activeFilters).length;

  if (filterableFields.length === 0) return null;

  const renderFilterControl = (field: TemplateField) => {
    const currentFilter = activeFilters[field.name];

    switch (field.type) {
      case 'string': {
        const uniqueValues = getUniqueValues(posts, field.name);
        if (uniqueValues.length === 0) return null;
        return (
          <div key={field.name} className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {field.name}
            </label>
            <select
              value={currentFilter?.value || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  onFilterChange(field.name, null);
                } else {
                  onFilterChange(field.name, { type: 'string', value: val });
                }
              }}
              className={`text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs ${
                currentFilter
                  ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-medium'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <option value="" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                全部 ({field.name})
              </option>
              {uniqueValues.map((v) => (
                <option key={v} value={v} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                  {v}
                </option>
              ))}
            </select>
          </div>
        );
      }

      case 'date': {
        const range = getDateRange(posts, field.name);
        return (
          <div key={field.name} className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {field.name}
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={currentFilter?.value?.from || ''}
                min={range.min}
                max={range.max}
                onChange={(e) => {
                  const from = e.target.value;
                  const to = currentFilter?.value?.to || '';
                  if (!from && !to) {
                    onFilterChange(field.name, null);
                  } else {
                    onFilterChange(field.name, { type: 'date', value: { from, to } });
                  }
                }}
                className={`text-xs px-2 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs ${
                  currentFilter?.value?.from
                    ? 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 font-medium'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              />
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">至</span>
              <input
                type="date"
                value={currentFilter?.value?.to || ''}
                min={range.min}
                max={range.max}
                onChange={(e) => {
                  const to = e.target.value;
                  const from = currentFilter?.value?.from || '';
                  if (!from && !to) {
                    onFilterChange(field.name, null);
                  } else {
                    onFilterChange(field.name, { type: 'date', value: { from, to } });
                  }
                }}
                className={`text-xs px-2 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs ${
                  currentFilter?.value?.to
                    ? 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 font-medium'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              />
            </div>
          </div>
        );
      }

      case 'array': {
        const allTags = getUniqueValues(posts, field.name);
        if (allTags.length === 0) return null;
        const selectedTags: string[] = currentFilter?.value || [];
        return (
          <div key={field.name} className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {field.name}
            </label>
            <div className="flex flex-wrap gap-1.5 max-w-lg">
              {allTags.slice(0, 16).map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      let newTags: string[];
                      if (isSelected) {
                        newTags = selectedTags.filter((t) => t !== tag);
                      } else {
                        newTags = [...selectedTags, tag];
                      }
                      if (newTags.length === 0) {
                        onFilterChange(field.name, null);
                      } else {
                        onFilterChange(field.name, { type: 'array', value: newTags });
                      }
                    }}
                    className={`
                      px-2.5 py-0.5 rounded-full text-xs font-medium transition-all border cursor-pointer select-none
                      ${
                        isSelected
                          ? 'bg-purple-500/15 dark:bg-purple-500/25 text-purple-700 dark:text-purple-300 border-purple-400/60 dark:border-purple-500/60 shadow-2xs ring-1 ring-purple-500/20 font-semibold'
                          : 'bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-200/90 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                      }
                    `}
                  >
                    {tag}
                  </button>
                );
              })}
              {allTags.length > 16 && (
                <span className="text-xs text-slate-400 dark:text-slate-500 self-center pl-1">
                  +{allTags.length - 16}
                </span>
              )}
            </div>
          </div>
        );
      }

      case 'boolean': {
        const currentVal = currentFilter?.value; // true | false | undefined (all)
        return (
          <div key={field.name} className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {field.name}
            </label>
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
              {[
                { label: '全部', val: undefined },
                { label: 'True', val: true },
                { label: 'False', val: false },
              ].map((opt) => {
                const isActive =
                  currentVal === opt.val || (opt.val === undefined && currentVal === undefined);
                return (
                  <button
                    key={String(opt.val)}
                    type="button"
                    onClick={() => {
                      if (opt.val === undefined) {
                        onFilterChange(field.name, null);
                      } else {
                        onFilterChange(field.name, { type: 'boolean', value: opt.val });
                      }
                    }}
                    className={`
                      px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer
                      ${
                        isActive
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }
                    `}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      case 'number': {
        const range = getNumberRange(posts, field.name);
        return (
          <div key={field.name} className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {field.name}
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder={String(range.min)}
                value={currentFilter?.value?.min ?? ''}
                onChange={(e) => {
                  const min = e.target.value === '' ? undefined : Number(e.target.value);
                  const max = currentFilter?.value?.max;
                  if (min === undefined && max === undefined) {
                    onFilterChange(field.name, null);
                  } else {
                    onFilterChange(field.name, { type: 'number', value: { min, max } });
                  }
                }}
                className={`text-xs px-2 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-20 transition-all shadow-2xs ${
                  currentFilter?.value?.min !== undefined
                    ? 'bg-teal-50/90 dark:bg-teal-950/50 border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-200 font-medium'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              />
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">至</span>
              <input
                type="number"
                placeholder={String(range.max)}
                value={currentFilter?.value?.max ?? ''}
                onChange={(e) => {
                  const max = e.target.value === '' ? undefined : Number(e.target.value);
                  const min = currentFilter?.value?.min;
                  if (min === undefined && max === undefined) {
                    onFilterChange(field.name, null);
                  } else {
                    onFilterChange(field.name, { type: 'number', value: { min, max } });
                  }
                }}
                className={`text-xs px-2 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-20 transition-all shadow-2xs ${
                  currentFilter?.value?.max !== undefined
                    ? 'bg-teal-50/90 dark:bg-teal-950/50 border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-200 font-medium'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              />
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md p-4 space-y-3.5 shadow-sm transition-all">
      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            {t('filterBar.title') || '筛选条件'}
          </span>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300 border border-blue-500/20">
              已选 {activeFilterCount} 项
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t('filterBar.clearAll') || '清空筛选'}</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-5 items-end">
        {filterableFields.map((field) => renderFilterControl(field))}
      </div>
    </div>
  );
};

// Helper to check if a post matches a filter value
export const matchesFilter = (
  fieldValue: any,
  filter: FilterValue
): boolean => {
  switch (filter.type) {
    case 'string':
      return String(fieldValue) === filter.value;

    case 'date': {
      if (!fieldValue) return false;
      const d = fieldValue instanceof Date ? fieldValue : new Date(fieldValue);
      if (isNaN(d.getTime())) return false;
      const iso = d.toISOString().split('T')[0];
      const { from, to } = filter.value;
      if (from && iso < from) return false;
      if (to && iso > to) return false;
      return true;
    }

    case 'array': {
      if (!Array.isArray(fieldValue)) return false;
      const selectedTags: string[] = filter.value;
      return selectedTags.some(tag => fieldValue.map(String).includes(tag));
    }

    case 'boolean':
      return Boolean(fieldValue) === filter.value;

    case 'number': {
      const num = Number(fieldValue);
      if (isNaN(num)) return false;
      const { min, max } = filter.value;
      if (min !== undefined && num < min) return false;
      if (max !== undefined && num > max) return false;
      return true;
    }

    default:
      return true;
  }
};

export default FilterBar;
