import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/registry/shadcn/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/registry/shadcn/card';

export class AdminErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[admin.render_failed]', error, info.componentStack);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>后台界面加载失败</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>请刷新页面重试。如果问题持续存在，请检查浏览器控制台和 Worker 日志。</p>
            <Button onClick={() => window.location.reload()}>重新加载</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}
