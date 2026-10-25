import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { D1ReleaseService } from '../../scripts/d1-release.mjs';

/** 仅在内存中模拟 D1 的文件级事务与账本，不调用真实 CLI。 */
function fixture(entries, { failFile, unknownAfterApply = false } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE existing(id INTEGER PRIMARY KEY); INSERT INTO existing VALUES(1);');
  db.exec('CREATE TABLE d1_migrations(name TEXT PRIMARY KEY);');
  const calls = [];
  const pending = () =>
    entries
      .map(({ file }) => file)
      .filter((file) => !db.prepare('SELECT name FROM d1_migrations WHERE name=?').get(file));
  const service = new D1ReleaseService({
    readSql: async (path) => entries.find(({ file }) => path.endsWith(`/${file}`)).sql,
    run: async (_command, args) => {
      calls.push(args);
      assert.ok(args.includes('d1') && args.includes('migrations'));
      if (args.includes('list')) {
        const files = pending();
        return files.length
          ? `Migrations to be applied:\n│ Name │\n${files.map((file) => `│ ${file} │`).join('\n')}`
          : '✅ No migrations to apply!';
      }
      assert.ok(args.includes('apply'));
      for (const file of pending()) {
        db.exec('BEGIN');
        try {
          if (file === failFile) throw new Error('simulated migration failure');
          db.exec(entries.find((entry) => entry.file === file).sql);
          db.prepare('INSERT INTO d1_migrations VALUES(?)').run(file);
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      }
      if (unknownAfterApply) throw new Error('unknown remote outcome');
      return '';
    },
  });
  return { db, calls, pending, service };
}
const revision = { base: 'a'.repeat(40), head: 'b'.repeat(40) };
const added = (files) => ({ migrationChanged: true, added: files, modified: [] });

test('真实升级保留既有行，自动新增可空列/索引后重跑不重复执行', async () => {
  const file = '0006_nullable.sql';
  const f = fixture([
    {
      file,
      sql: 'ALTER TABLE existing ADD note TEXT; CREATE INDEX existing_note ON existing(note);',
    },
  ]);
  try {
    await f.service.apply(await f.service.prepare(added([file]), revision));
    assert.deepEqual({ ...f.db.prepare('SELECT * FROM existing').get() }, { id: 1, note: null });
    assert.deepEqual(f.pending(), []);
    await f.service.apply(await f.service.prepare(added([file]), revision));
    assert.equal(f.calls.filter((args) => args.includes('apply')).length, 1);
  } finally {
    f.db.close();
  }
});

test('第二个迁移失败不回滚已完成文件，不自动重试', async () => {
  const files = ['0006_first.sql', '0007_second.sql'];
  const f = fixture(
    files.map((file, index) => ({ file, sql: `CREATE TABLE next${index}(id INTEGER);` })),
    { failFile: files[1] },
  );
  try {
    const plan = await f.service.prepare(added(files), revision);
    await assert.rejects(f.service.apply(plan), /migration failure/);
    assert.deepEqual(f.pending(), [files[1]]);
    assert.ok(f.db.prepare("SELECT name FROM sqlite_master WHERE name='next0'").get());
    assert.equal(
      f.db.prepare("SELECT name FROM sqlite_master WHERE name='next1'").get(),
      undefined,
    );
    assert.equal(f.calls.filter((args) => args.includes('apply')).length, 1);
  } finally {
    f.db.close();
  }
});

test('执行已完成但返回超时时不重试，后续显式核验不会重放', async () => {
  const file = '0006_once.sql';
  const f = fixture([{ file, sql: 'CREATE TABLE once_only(id INTEGER);' }], {
    unknownAfterApply: true,
  });
  try {
    const plan = await f.service.prepare(added([file]), revision);
    await assert.rejects(f.service.apply(plan), /unknown remote outcome/);
    assert.deepEqual(f.pending(), []);
    assert.equal(f.calls.filter((args) => args.includes('apply')).length, 1);
    await f.service.apply(await f.service.prepare(added([file]), revision));
    assert.equal(f.calls.filter((args) => args.includes('apply')).length, 1);
  } finally {
    f.db.close();
  }
});
