import { ArrowLeft, Check, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { patchLiteral, readLiteral } from '../jsx-attributes';
import { useComponentInspector } from './InspectorContext';
import { findComponent } from './registry';

interface ComponentPropertiesProps {
  onBack?: () => void;
}

export function ComponentProperties({ onBack }: ComponentPropertiesProps) {
  const inspector = useComponentInspector();
  const selected = inspector.selectedComponent;
  const definition = findComponent(selected?.name);

  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync values when selected component changes
  useEffect(() => {
    if (selected) {
      setValues(selected.attributes ?? {});
      setDirty(false);
      setError('');
      setSavedSuccess(false);
    } else {
      setValues({});
      setDirty(false);
    }
  }, [selected]);

  const handleBack = () => {
    if (dirty) {
      const confirmLeave = window.confirm('当前组件有未应用的修改，返回组件库将丢弃未保存的修改，确定继续吗？');
      if (!confirmLeave) return;
    }
    setDirty(false);
    if (onBack) {
      onBack();
    } else {
      inspector.returnToLibrary();
    }
  };

  const handleFieldChange = (fieldName: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
    setDirty(true);
    setSavedSuccess(false);
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    try {
      if (selected.applyAttributes) {
        selected.applyAttributes(values);
      }
      setDirty(false);
      setError('');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '参数更新失败');
    }
  };

  if (!selected || !definition) {
    return (
      <div className="p-6 text-center text-xs text-notion-muted">
        <p className="mb-3">未选中组件。</p>
        <p className="mb-4 text-[11px] leading-relaxed">
          点击正文中的组件，或在「组件库」的“本文已用”列表中点击任意组件即可在此配置参数。
        </p>
        <button
          type="button"
          onClick={() => inspector.setMode('library')}
          className="inline-flex items-center gap-1.5 rounded-md border border-notion-border bg-notion-sidebar px-3 py-1.5 font-medium text-notion-text hover:bg-notion-hover"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          前往组件库
        </button>
      </div>
    );
  }

  return (
    <div className="p-5 text-xs text-notion-text">
      {/* Top back button */}
      <div className="mb-4 flex items-center justify-between border-b border-notion-border pb-3">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1 text-notion-muted hover:text-notion-text text-[11px] font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回组件库
        </button>
        {dirty && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
            ● 有未应用的修改
          </span>
        )}
      </div>

      {/* Header Info */}
      <div className="mb-4 rounded-lg bg-notion-sidebar/60 border border-notion-border p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-notion-text flex items-center gap-1.5">
            <span>{definition.label}</span>
            <span className="font-mono text-[10px] text-notion-muted font-normal">
              &lt;{definition.name}&gt;
            </span>
          </h3>
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-medium border ${
              definition.supportLevel === 'configurable'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}
          >
            {definition.supportLevel === 'configurable' ? '可配置' : '需源码配置'}
          </span>
        </div>
        <p className="text-[11px] text-notion-muted mt-1 truncate">
          {selected.instanceContext || `本文组件 · ${selected.summary}`}
        </p>
      </div>

      <div className="mb-4 rounded-md bg-notion-sidebar p-2.5 text-[11px] text-notion-muted leading-relaxed flex items-start gap-1.5 border border-notion-border/60">
        <Info className="h-3.5 w-3.5 text-notion-blue shrink-0 mt-0.5" />
        <span>显示文字在正文中直接编辑；此处的参数配置仅作用于当前选中的组件节点。</span>
      </div>

      {!definition.enabled ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-400">
          项目配置已关闭该组件的可视化属性编辑，已有内容完整保留；如需修改请使用源码模式。
        </div>
      ) : (
        <form onSubmit={handleApply} className="space-y-4">
          {definition.fields.map((field) => {
            const { name, label } = field;
            // Check if field is editable literal
            const rawAttr = selected.rawNode?.attributes;
            const editable =
              field.control !== 'source' &&
              (rawAttr ? readLiteral(rawAttr, name).editable : true);

            return (
              <div key={name}>
                <label className="mb-1 block font-medium text-notion-text">
                  {label} {field.required && <span className="text-red-500">*</span>}
                </label>

                {field.control === 'select' ? (
                  <select
                    disabled={!editable}
                    value={values[name] ?? ''}
                    onChange={(e) => handleFieldChange(name, e.target.value)}
                    className="w-full rounded-md border border-notion-border bg-notion-bg px-2.5 py-1.5 text-xs text-notion-text focus:outline-none focus:ring-1 focus:ring-notion-blue disabled:opacity-50"
                  >
                    <option value="">默认样式</option>
                    {Object.entries(field.options ?? {}).map(([val, text]) => (
                      <option key={val} value={val}>
                        {text}
                      </option>
                    ))}
                  </select>
                ) : field.control === 'color' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        disabled={!editable}
                        value={values[name] || '#87cefa'}
                        onChange={(e) => handleFieldChange(name, e.target.value)}
                        className="h-8 w-10 cursor-pointer rounded border border-notion-border p-0.5 bg-transparent"
                      />
                      <input
                        type="text"
                        disabled={!editable}
                        value={values[name] ?? ''}
                        placeholder={field.placeholder || '#87cefa'}
                        onChange={(e) => handleFieldChange(name, e.target.value)}
                        className="flex-1 rounded-md border border-notion-border bg-notion-bg px-2.5 py-1.5 font-mono text-xs text-notion-text focus:outline-none focus:ring-1 focus:ring-notion-blue disabled:opacity-50"
                      />
                    </div>
                    {editable && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] text-notion-muted">预设：</span>
                        {[
                          { color: '#ffd1dc', label: '樱粉' },
                          { color: '#87cefa', label: '天蓝' },
                          { color: '#a7f3d0', label: '薄荷' },
                          { color: '#fde68a', label: '柠檬' },
                          { color: '#e9d5ff', label: '紫薯' },
                        ].map(({ color, label: swatchLabel }) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => handleFieldChange(name, color)}
                            title={`${swatchLabel} (${color})`}
                            style={{ backgroundColor: color }}
                            className="h-4 w-4 rounded-full border border-black/10 dark:border-white/20 hover:scale-125 transition-transform shadow-2xs"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : field.control === 'source' ? (
                  <div className="rounded-md border border-notion-border/80 bg-notion-sidebar/60 p-2.5 text-[11px] text-notion-muted">
                    <span>此属性为复杂表达式或对象数据，已在源码中保护，请切换至源码视图编辑。</span>
                  </div>
                ) : (
                  <input
                    type="text"
                    disabled={!editable}
                    value={values[name] ?? ''}
                    placeholder={field.placeholder}
                    onChange={(e) => handleFieldChange(name, e.target.value)}
                    className="w-full rounded-md border border-notion-border bg-notion-bg px-2.5 py-1.5 text-xs text-notion-text focus:outline-none focus:ring-1 focus:ring-notion-blue disabled:opacity-50"
                  />
                )}

                {!editable && field.control !== 'source' && (
                  <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                    该属性包含 JS 表达式或动态覆盖，请在源码中编辑。
                  </p>
                )}
              </div>
            );
          })}

          {error && (
            <div className="rounded-md border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {savedSuccess && (
            <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 p-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <Check className="h-3.5 w-3.5" />
              <span>参数已成功应用到正文</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={!dirty}
              className="w-full rounded-md bg-notion-blue px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-notion-blue/90 disabled:opacity-40 transition-colors"
            >
              应用参数
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
