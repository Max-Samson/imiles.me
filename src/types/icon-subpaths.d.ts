// 图标包未为每个 .mjs 单文件入口提供声明；复用上游类型，避免丢失图标属性约束。
// 此处仅导入类型，不会把两个完整图标聚合入口带进运行时。
declare module '@tabler/icons-react/dist/esm/icons/*.mjs' {
  import type { TablerIcon } from '@tabler/icons-react';
  const Icon: TablerIcon;
  export default Icon;
}

declare module '@icons-pack/react-simple-icons/icons/*.mjs' {
  const Icon: typeof import('@icons-pack/react-simple-icons').SiGithub;
  export default Icon;
}
