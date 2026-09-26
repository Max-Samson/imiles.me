import { Menu, ShieldCheck } from 'lucide-react';
import { Button } from '@/registry/shadcn/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/registry/shadcn/sheet';
import { adminNavigation } from './nav';

export function AdminMobileNavigation({ section }: { section: 'dashboard' | 'friend-links' }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="打开后台导航">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <div className="mb-7 flex items-center gap-3 pr-8">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <SheetTitle className="font-semibold">管理后台</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">imiles.me</SheetDescription>
          </div>
        </div>
        <nav aria-label="移动端后台导航" className="space-y-1">
          {adminNavigation.map((item) => {
            const Icon = item.icon;
            return item.enabled ? (
              <a
                key={item.href}
                href={item.href}
                aria-current={
                  (section === 'dashboard' ? '/admin' : '/admin/friend-links') === item.href
                    ? 'page'
                    : undefined
                }
                className={`flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium ${(section === 'dashboard' ? '/admin' : '/admin/friend-links') === item.href ? 'bg-accent' : 'text-muted-foreground'}`}
              >
                <Icon className="size-4" />
                {item.label}
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
