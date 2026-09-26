import { LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import type { AdminSessionActor } from '../../shared/admin/session-contract';
import { AdminMobileNavigation } from './AdminMobileNavigation';

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

export function AdminHeader({ actor }: { actor: AdminSessionActor }) {
  const label = actor.kind === 'user' ? actor.email : actor.clientId;
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-6">
      <AdminMobileNavigation />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>管理后台</span>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-foreground">概览</span>
        </div>
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
