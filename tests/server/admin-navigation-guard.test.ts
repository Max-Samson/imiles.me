import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canLeaveAdminModule, registerAdminLeaveGuard } from '../../src/lib/admin/navigation-guard';

test('后台离开保护支持取消，且旧模块清理不会移除新模块的保护', () => {
  assert.equal(canLeaveAdminModule(), true);
  const oldCleanup = registerAdminLeaveGuard(() => true);
  const newCleanup = registerAdminLeaveGuard(() => false);
  oldCleanup();
  assert.equal(canLeaveAdminModule(), false);
  newCleanup();
  assert.equal(canLeaveAdminModule(), true);
});
