import type { LucideIcon } from 'lucide-react';

/** 后台功能模块所属分类 */
export type AdminModuleCategory = 'core' | 'business' | 'system';

/**
 * 后台功能导航与业务模块配置接口。
 * 每一个配置项代表一个完整的后台功能模块，并在侧栏、Header 标签页与路由系统中自动适配。
 */
export interface AdminNavItem {
  /** 模块唯一标识键，如 'dashboard' | 'friend-links' | 'settings' 等。 */
  key: string;
  /** 导航展示中文名称。 */
  label: string;
  /** 访问路由路径，必须以 /admin 开头。 */
  href: string;
  /** 关联的 Lucide 图标组件。 */
  icon: LucideIcon;
  /** 是否启用。为 true 时支持点击访问与标签页打开，为 false 时侧栏标注待接入。 */
  enabled: boolean;
  /** 模块描述信息，用于 Header 快捷菜单、Tab 提示与自动生成的管理页。 */
  description?: string;
  /** 模块归属分类 */
  category?: AdminModuleCategory;
  /** 功能标签徽章文本，例如 '核心' | '业务' | '待接入'。 */
  badge?: string;
  /** 该模块所需的基础操作权限，默认包含 'admin:read'。 */
  requiredCapability?: string;
}

/**
 * Header 多标签页数据模型。
 */
export interface AdminTab {
  /** 标签唯一标识，对应功能路径。 */
  id: string;
  /** 标签显示的名称。 */
  title: string;
  /** 点击跳转的目标链接。 */
  href: string;
  /** 关联的 Lucide 图标组件。 */
  icon?: LucideIcon;
}
