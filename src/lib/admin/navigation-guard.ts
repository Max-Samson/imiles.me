/** 当前后台模块注册离开检查；不存文章内容，也不建立第二套草稿状态。 */
let guard: (() => Promise<boolean>) | undefined;
export function registerAdminLeaveGuard(check: () => Promise<boolean>) {
  guard = check;
  return () => {
    if (guard === check) guard = undefined;
  };
}
export async function canLeaveAdminModule() {
  return (await guard?.()) ?? true;
}
