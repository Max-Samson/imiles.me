import { FileText, LayoutDashboard, LogOut, Moon, Plus, Sun, UserRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback } from '@/registry/shadcn/avatar';
import { Button } from '@/registry/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/registry/shadcn/dropdown-menu';
import { cn } from '../../lib/utils';
import type { AdminSessionActor } from '../../shared/admin/session-contract';
import { AdminMobileNavigation } from './AdminMobileNavigation';
import { useAdminRouter } from './AdminRouterContext';
import { type AdminNavItem, type AdminTab, adminNavigation, findNavItemByKey } from './config';
export type { AdminTab };

/** 本地存储中已开启功能标签页列表的缓存键名。 */
const STORAGE_KEY = 'imiles_admin_tabs';

/**
 * 根据当前激活的路由状态与统一导航配置生成当前标签页对象。
 */
function resolveCurrentTab(section: string, friendLinkId?: string): AdminTab {
  if (section === 'friend-links' && friendLinkId) {
    return {
      id: `/admin/friend-links/${friendLinkId}`,
      title: '友链详情',
      href: `/admin/friend-links/${friendLinkId}`,
      icon: FileText,
    };
  }

  const matched = findNavItemByKey(section) ?? adminNavigation[0];
  if (matched) {
    return {
      id: matched.href,
      title: matched.label,
      href: matched.href,
      icon: matched.icon,
    };
  }

  return {
    id: '/admin',
    title: '概览',
    href: '/admin',
    icon: LayoutDashboard,
  };
}

/**
 * 明暗双模主题切换按钮。
 */
function ThemeButton() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setDark(next);
  };
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={dark ? '切换到浅色主题' : '切换到深色主题'}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

/**
 * 后台管理系统顶部 Header 组件。
 * 集成移动端抽屉导航、多功能标签栏（自动基于 nav.ts 适配）、快捷功能菜单、主题切换与管理员操作菜单。
 */
export function AdminHeader({
  actor,
  section,
  friendLinkId,
}: {
  actor: AdminSessionActor;
  section: string;
  friendLinkId?: string;
}) {
  const { navigate } = useAdminRouter();
  const label = actor.kind === 'user' ? actor.email : actor.clientId;

  // 根据当前访问路由动态解析当前激活标签
  const currentTab = useMemo(
    () => resolveCurrentTab(section, friendLinkId),
    [section, friendLinkId],
  );

  // 维护当前已开启的所有标签列表，初始值采用当前标签避免初次渲染白屏
  const [tabs, setTabs] = useState<AdminTab[]>([currentTab]);

  // 同步本地存储中的历史标签页，并将当前访问的新功能自动登记至标签列表中
  useEffect(() => {
    let saved: AdminTab[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          saved = parsed
            .filter((item) =>
              Boolean(
                item &&
                  typeof item.id === 'string' &&
                  typeof item.href === 'string' &&
                  typeof item.title === 'string',
              ),
            )
            .map((item) => {
              // 从 nav.ts 恢复最新配置的图标引用，确保换图标时立即生效
              const navMatch = adminNavigation.find((n) => n.href === item.href);
              return {
                id: item.id,
                title: navMatch?.label ?? item.title,
                href: item.href,
                icon: item.id.includes('/admin/friend-links/')
                  ? FileText
                  : (navMatch?.icon ?? LayoutDashboard),
              };
            });
        }
      }
    } catch {
      // 忽略存储访问或反序列化异常
    }

    const exists = saved.some((tab) => tab.id === currentTab.id);
    const merged = exists ? saved : [...saved, currentTab];
    const finalTabs = merged.length > 0 ? merged : [currentTab];

    setTabs(finalTabs);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(finalTabs.map((t) => ({ id: t.id, title: t.title, href: t.href }))),
      );
    } catch {
      // 忽略存储写入异常
    }
  }, [currentTab]);

  /** 点击标签页无刷新切换 */
  const handleTabClick = (tab: AdminTab) => {
    if (tab.id === currentTab.id) return;
    navigate(tab.href);
  };

  /**
   * 关闭指定标签页。
   * 若关闭的是当前正在激活的页面，自动平滑回退至相邻标签页；若全部关闭则回退至默认主页。
   */
  const handleCloseTab = (tabToClose: AdminTab) => {
    const defaultNav = adminNavigation[0] ?? {
      key: 'dashboard',
      label: '概览',
      href: '/admin',
      icon: LayoutDashboard,
    };
    const defaultTab: AdminTab = {
      id: defaultNav.href,
      title: defaultNav.label,
      href: defaultNav.href,
      icon: defaultNav.icon,
    };

    const remaining = tabs.filter((t) => t.id !== tabToClose.id);
    const fallbackTabs = remaining.length > 0 ? remaining : [defaultTab];

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(fallbackTabs.map((t) => ({ id: t.id, title: t.title, href: t.href }))),
      );
    } catch {
      // 忽略存储异常
    }

    setTabs(fallbackTabs);

    // 若关闭的是当前激活项，重定向至左侧相邻标签或剩余首个标签
    if (tabToClose.id === currentTab.id) {
      const closedIndex = tabs.findIndex((t) => t.id === tabToClose.id);
      const target = closedIndex > 0 ? tabs[closedIndex - 1] : fallbackTabs[0];
      navigate(target.href);
    }
  };

  /** 一键关闭其他所有标签，仅保留当前所在页面 */
  const handleCloseOthers = () => {
    const nextTabs = [currentTab];
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(nextTabs.map((t) => ({ id: t.id, title: t.title, href: t.href }))),
      );
    } catch {
      // 忽略存储异常
    }
    setTabs(nextTabs);
  };

  /** 一键关闭所有标签页并重置回到默认主页 */
  const handleCloseAll = () => {
    const defaultNav = adminNavigation[0] ?? {
      key: 'dashboard',
      label: '概览',
      href: '/admin',
      icon: LayoutDashboard,
    };
    const defaultTab: AdminTab = {
      id: defaultNav.href,
      title: defaultNav.label,
      href: defaultNav.href,
      icon: defaultNav.icon,
    };

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([{ id: defaultTab.id, title: defaultTab.title, href: defaultTab.href }]),
      );
    } catch {
      // 忽略存储异常
    }
    setTabs([defaultTab]);
    if (currentTab.id !== defaultTab.id) {
      navigate(defaultTab.href);
    }
  };

  /** 从快捷下拉菜单中打开某个功能模块并激活其标签 */
  const handleOpenFeature = (feature: AdminNavItem) => {
    const exists = tabs.some((t) => t.id === feature.href);
    if (!exists) {
      const newTab: AdminTab = {
        id: feature.href,
        title: feature.label,
        href: feature.href,
        icon: feature.icon,
      };
      const updated = [...tabs, newTab];
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(updated.map((t) => ({ id: t.id, title: t.title, href: t.href }))),
        );
      } catch {
        // 忽略存储异常
      }
    }
    navigate(feature.href);
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur md:gap-3 md:px-6">
      <AdminMobileNavigation section={section} />

      {/* 多功能标签页导航区 */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <nav
          aria-label="后台功能标签页"
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const isActive = tab.id === currentTab.id;
            const Icon = tab.icon ?? LayoutDashboard;
            const defaultHref = adminNavigation[0]?.href ?? '/admin';
            // 至少保留一个主标签页可操作，避免空白无标签状态
            const canClose = tabs.length > 1 || tab.id !== defaultHref;

            return (
              <div
                key={tab.id}
                className={cn(
                  'group relative flex h-8 shrink-0 items-center gap-1 rounded-md border text-xs font-medium transition-all select-none',
                  isActive
                    ? 'border-border/90 bg-background text-foreground shadow-xs dark:bg-card dark:border-border font-semibold'
                    : 'border-transparent text-muted-foreground hover:border-border/50 hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <a
                  href={tab.href}
                  onClick={(e) => {
                    // 仅拦截普通左键单击，保留 Command/Ctrl+Click 等原生新标签页打开特性
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      handleTabClick(tab);
                    }
                  }}
                  className="flex h-full items-center gap-1.5 rounded-l-md pl-2.5 pr-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    className={cn(
                      'size-3.5 shrink-0 transition-colors',
                      isActive
                        ? 'text-primary'
                        : 'text-muted-foreground/70 group-hover:text-foreground',
                    )}
                    aria-hidden="true"
                  />
                  <span className="max-w-[7rem] truncate sm:max-w-[9rem] md:max-w-[12rem]">
                    {tab.title}
                  </span>
                </a>

                {canClose ? (
                  <button
                    type="button"
                    aria-label={`关闭 ${tab.title}`}
                    title="关闭标签页"
                    className="mr-1.5 flex size-4 items-center justify-center rounded-sm text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCloseTab(tab);
                    }}
                  >
                    <X className="size-3" />
                  </button>
                ) : (
                  <span className="w-1.5" />
                )}
              </div>
            );
          })}
        </nav>

        {/* 快捷添加功能与标签页批量管理菜单：完全动态基于 nav.ts 配置生成 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="打开功能或管理标签页"
              title="打开功能"
            >
              <Plus className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              打开功能
            </DropdownMenuLabel>
            {adminNavigation
              .filter((item) => item.enabled)
              .map((item) => {
                const Icon = item.icon;
                const isOpen = tabs.some((t) => t.id === item.href);
                const isCurrent = currentTab.id === item.href;
                return (
                  <DropdownMenuItem
                    key={item.key}
                    className="flex items-center justify-between gap-2"
                    onClick={() => handleOpenFeature(item)}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" />
                      <span>{item.label}</span>
                    </div>
                    {isCurrent ? (
                      <span className="rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary">
                        当前
                      </span>
                    ) : isOpen ? (
                      <span className="text-[10px] text-muted-foreground">已开启</span>
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={tabs.length <= 1}
              onClick={handleCloseOthers}
              className="text-xs"
            >
              关闭其他标签页
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={tabs.length === 1 && tabs[0].id === (adminNavigation[0]?.href ?? '/admin')}
              onClick={handleCloseAll}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              关闭所有标签页
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ThemeButton />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-10 max-w-[15rem] gap-2 px-2" aria-label="管理员菜单">
            <Avatar>
              <AvatarFallback>
                <UserRound className="size-4" />
              </AvatarFallback>
            </Avatar>
            <span className="hidden truncate text-sm sm:block">{label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="space-y-1">
            <div className="text-xs font-normal text-muted-foreground">当前身份</div>
            <div className="truncate">{label}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href="/cdn-cgi/access/logout">
              <LogOut />
              退出登录
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
