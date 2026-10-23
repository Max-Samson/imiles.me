import {
  type ComponentCategory,
  type ContentComponentConfig,
  type ContentComponentField,
  contentComponents,
} from '../../../src/config/content-components';

export type { ComponentCategory, ContentComponentConfig, ContentComponentField };

export const componentRegistry = contentComponents;

export const findComponent = (name: string | null | undefined): ContentComponentConfig | undefined => {
  if (!name) return undefined;
  return componentRegistry.find((item) => item.name === name);
};

export const componentCategories: ComponentCategory[] = ['文字与链接', '内容容器', '展示组件'];
