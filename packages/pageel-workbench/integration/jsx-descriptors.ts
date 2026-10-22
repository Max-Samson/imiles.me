import type { JsxComponentDescriptor } from '@mdxeditor/editor';
import { RegisteredJsxEditor } from './components/RegisteredJsxEditor';
import { componentRegistry } from './component-config';

/** 单一白名单生成 MDXEditor 配置，导入信息与宿主编辑适配器不会分散维护。 */
export const jsxComponentDescriptors: JsxComponentDescriptor[] = componentRegistry.map(component => ({
  name: component.name, source: component.source, defaultExport: component.defaultExport,
  kind: component.kind, hasChildren: component.hasChildren,
  props: [
    ...component.fields.map(field => ({ name: field.name, type: field.control === 'source' ? 'expression' as const : 'string' as const })),
    { name: 'client:load', type: 'expression' }, { name: 'client:visible', type: 'expression' },
  ],
  Editor: RegisteredJsxEditor,
}));
