import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canLeaveAdminModule, registerAdminLeaveGuard } from '../../src/lib/admin/navigation-guard';

test('后台离开保护支持异步取消，且旧模块清理不会移除新模块的保护', async () => {
  assert.equal(await canLeaveAdminModule(), true);
  const oldCleanup = registerAdminLeaveGuard(async () => true);
  const newCleanup = registerAdminLeaveGuard(async () => false);
  oldCleanup();
  assert.equal(await canLeaveAdminModule(), false);
  newCleanup();
  assert.equal(await canLeaveAdminModule(), true);
});
