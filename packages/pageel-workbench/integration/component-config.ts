// 本地工作区适配边界：项目负责配置，Pageel 只消费元数据，不复制业务组件。
import { contentComponents } from '../../../src/config/content-components';

export const componentRegistry = contentComponents;
export const findComponent = (name: string | null) => componentRegistry.find(item => item.name === name);
