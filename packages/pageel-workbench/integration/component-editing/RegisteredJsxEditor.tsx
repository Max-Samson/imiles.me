import { GenericJsxEditor, type JsxEditorProps, useMdastNodeUpdater } from '@mdxeditor/editor';
import {
  type CSSProperties,
  useEffect,
  useId,
  useMemo,
  useRef,
} from 'react';
import { patchLiteral, readLiteral } from '../jsx-attributes';
import { useComponentInspector } from './InspectorContext';
import { findComponent } from './registry';

/** 编辑时只呈现静态样式，不执行真实 Highlighter 动画或链接跳转。 */
export function RegisteredJsxEditor(props: JsxEditorProps) {
  const { descriptor, mdastNode } = props;
  const definition = findComponent(mdastNode.name);
  const inspector = useComponentInspector();
  const id = useId();
  const domRef = useRef<HTMLDivElement>(null);

  const update = useMdastNodeUpdater<JsxEditorProps['mdastNode']>();
  const descriptorWithoutPopover = useMemo(() => ({ ...descriptor, props: [] }), [descriptor]);

  const updateAttributes = (values: Record<string, string>) => {
    // 以当前 AST 为基础，只更新发生变化的字面量；不触碰 children 或其他属性。
    let attributes = mdastNode.attributes;
    for (const [name, value] of Object.entries(values)) {
      const before = readLiteral(attributes, name);
      if (before.editable && before.value !== value) {
        attributes = patchLiteral(attributes, mdastNode.name, name, value);
      }
    }
    if (attributes !== mdastNode.attributes) {
      update({ attributes });
    }
  };

  // Register this node with InspectorContext
  useEffect(() => {
    inspector.registerNode(id, {
      id,
      name: mdastNode.name,
      mdastNode,
      domElement: domRef.current,
      updateAttributes,
    });
    return () => {
      inspector.unregisterNode(id);
    };
  });

  const isSelected = inspector.selectedId === id;

  const color = readLiteral(mdastNode.attributes, 'color').value;
  const action = readLiteral(mdastNode.attributes, 'action').value || 'highlight';
  const style = /^#[\da-f]{3}([\da-f]{3})?$/i.test(color)
    ? ({ '--cms-highlight-color': color } as CSSProperties)
    : undefined;
  const label = definition?.label ?? mdastNode.name ?? '组件';

  const handleSelect = (e: React.MouseEvent | React.FocusEvent) => {
    e.stopPropagation();
    inspector.selectNode(id, mdastNode, updateAttributes);
  };

  return (
    <div
      ref={domRef}
      className={descriptor.kind === 'text' ? 'cms-jsx-inline' : 'cms-jsx-block'}
      data-component={mdastNode.name}
      data-action={action}
      data-selected={isSelected}
      style={style}
      onClick={handleSelect}
      onFocus={handleSelect}
      title={`${label}：点击文字或配置按钮，在右侧查看参数`}
    >
      {descriptor.kind === 'flow' && (
        <div className="cms-jsx-label" contentEditable={false}>
          <div className="cms-jsx-label-info">
            <span className="cms-jsx-dot" />
            <span className="cms-jsx-title">{label}</span>
            <span className="cms-jsx-tag">&lt;{mdastNode.name}&gt;</span>
          </div>
          <button
            type="button"
            className="cms-jsx-config-btn"
            aria-label={`配置${label}`}
            onClick={handleSelect}
          >
            配置参数
          </button>
        </div>
      )}
      {descriptor.kind === 'text' && (
        <button
          type="button"
          contentEditable={false}
          className="cms-component-select"
          aria-label={`配置${label}`}
          onClick={handleSelect}
        >
          配置 {label}
        </button>
      )}
      <GenericJsxEditor {...props} descriptor={descriptorWithoutPopover} />
    </div>
  );
}
