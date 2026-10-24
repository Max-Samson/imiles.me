import { type ComponentProps, lazy, Suspense, useEffect, useState } from 'react';
import type { PlexusBackground as PlexusBackgroundType } from './plexus-webgl/PlexusScene';

// SSR 编译时静态移除 WebGL 导入；单独使用 React.lazy 仍会打包 Three.js。
const PlexusSceneLazy = import.meta.env.SSR
  ? null
  : lazy(() => import('./plexus-webgl/PlexusScene').then((m) => ({ default: m.PlexusBackground })));

export function PlexusBackground(props: ComponentProps<typeof PlexusBackgroundType>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // 服务端与客户端首次渲染保持一致；仅延迟图形层，保留 Hero 文字与布局的 SSR。
  if (!mounted || !PlexusSceneLazy) return null;
  return (
    <Suspense fallback={null}>
      <PlexusSceneLazy {...props} />
    </Suspense>
  );
}
