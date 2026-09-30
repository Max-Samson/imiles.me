import { Menu } from 'lucide-react';
import { Button } from '@/registry/shadcn/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/registry/shadcn/sheet';
import { cn } from '../../lib/utils';
import { adminNavigation } from './config';

/**
 * 后台移动端抽屉导航组件。
 * 在小屏幕设备上自适应展开导航列表，完全基于 nav.ts 配置动态渲染。
 */
export function AdminMobileNavigation({ section }: { section: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="打开后台导航">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <div className="mb-7 flex items-center gap-3 pr-8">
          <div className="size-9 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/30 shadow-xs">
            <img
              src="/images/weblogo.jpeg"
              alt="imiles logo"
              className="size-full object-cover"
              width={36}
              height={36}
            />
          </div>
          <div>
            <SheetTitle className="font-semibold text-base leading-tight">管理后台</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">imiles.me</SheetDescription>
          </div>
        </div>
        <nav aria-label="移动端后台导航" className="space-y-1">
          {adminNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = section === item.key;
            return item.enabled ? (
              <a
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                {item.label}
                {item.badge && (
                  <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {item.badge}
                  </span>
                )}
              </a>
            ) : (
              <span
                key={item.href}
                aria-disabled="true"
                className="flex h-11 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground opacity-65"
              >
                <Icon className="size-4" />
                {item.label}
                <span className="ml-auto text-[10px]">待接入</span>
              </span>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
