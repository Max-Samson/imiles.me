import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/registry/shadcn/button';
import { cn } from '../../lib/utils';
import { adminNavigation } from './config';

/**
 * 后台桌面端常驻左侧边栏导航组件。
 * 根据 nav.ts 动态渲染导航列表，支持折叠与展开，并自动高亮当前激活功能。
 */
export function AdminSidebar({ section }: { section: string }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'hidden border-r bg-sidebar text-sidebar-foreground transition-[width] lg:flex lg:flex-col',
        collapsed ? 'w-[4.5rem]' : 'w-60',
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b px-3.5">
        <a
          href="/admin"
          className="flex items-center gap-3 min-w-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-lg p-1"
          title="管理后台 · imiles.me"
        >
          <div className="size-9 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/30 shadow-xs transition-transform group-hover:scale-105">
            <img
              src="/images/weblogo.jpeg"
              alt="imiles logo"
              className="size-full object-cover"
              width={36}
              height={36}
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
                管理后台
              </span>
              <span className="block truncate text-[11px] text-muted-foreground/80">imiles.me</span>
            </div>
          )}
        </a>
      </div>
      <nav aria-label="后台主导航" className="flex-1 space-y-1 p-3">
        {adminNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = section === item.key;
          return item.enabled ? (
            <a
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {!collapsed && item.label}
              {!collapsed && item.badge && (
                <span className="ml-auto rounded bg-sidebar-accent/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {item.badge}
                </span>
              )}
            </a>
          ) : (
            <span
              key={item.href}
              title={collapsed ? `${item.label}（待接入）` : undefined}
              className="flex h-10 cursor-not-allowed items-center gap-3 rounded-md px-3 text-sm text-muted-foreground opacity-65"
              aria-disabled="true"
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {!collapsed && (
                <>
                  <span>{item.label}</span>
                  <span className="ml-auto text-[10px]">待接入</span>
                </>
              )}
            </span>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          className={cn(
            'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/70 transition-colors',
            collapsed ? 'mx-auto' : 'w-full justify-start gap-2.5',
          )}
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
          title={collapsed ? '展开侧栏' : '收起侧栏'}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4 shrink-0" />
          ) : (
            <PanelLeftClose className="size-4 shrink-0" />
          )}
          {!collapsed && <span className="text-xs">收起侧栏</span>}
        </Button>
      </div>
    </aside>
  );
}
