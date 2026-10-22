import type { JsxEditorProps } from '@mdxeditor/editor';
import { findComponent } from './component-config';
type Attributes = JsxEditorProps['mdastNode']['attributes'];

/** 表达式、重复属性和 spread 的优先级无法由普通表单推断，必须保留源码处理。 */
export function readLiteral(attributes: Attributes, name: string) {
  const matches = attributes.filter(item => item.type === 'mdxJsxAttribute' && item.name === name);
  const safe = !attributes.some(item => item.type === 'mdxJsxExpressionAttribute') && matches.length <= 1;
  const attr = matches[0];
  if (!safe || (attr && (attr.type !== 'mdxJsxAttribute' || typeof attr.value !== 'string'))) return { editable: false, value: '' };
  return { editable: true, value: attr && attr.type === 'mdxJsxAttribute' ? String(attr.value) : '' };
}

/** 只替换指定白名单属性，其他节点（包括布尔 hydration、未知属性和位置数据）原样保留。 */
export function patchLiteral(attributes: Attributes, component: string | null, name: string, value: string): Attributes {
  const config = findComponent(component);
  const field = config?.fields.find(field => field.name === name);
  if (!config?.enabled || !field || field.control === 'source') throw new Error('该参数需要在源码中编辑');
  if (!readLiteral(attributes, name).editable) throw new Error('该属性含表达式或存在覆盖关系，请在源码中编辑');
  if (field.required && !value.trim()) throw new Error(`${field.label}不能为空`);
  if (value && field.control === 'select' && !Object.hasOwn(field.options ?? {}, value)) throw new Error('请选择支持的强调样式');
  if (value && field.control === 'color' && !/^#[\da-f]{3}([\da-f]{3})?$/i.test(value)) throw new Error('请输入 #RGB 或 #RRGGBB 颜色');
  if (value && field.control === 'url' && !/^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*|#[^\s]*)$/i.test(value)) throw new Error('链接需使用 http(s)、站内路径或锚点');
  // 空字符串表示移除该参数，恢复组件默认值；不会写成空的 JSX 表达式。
  let found = false;
  const next = attributes.flatMap(item => {
    if (item.type !== 'mdxJsxAttribute' || item.name !== name) return [item];
    found = true;
    return value ? [{ ...item, value }] : [];
  });
  if (!found && value) next.push({ type: 'mdxJsxAttribute', name, value });
  return next;
}
