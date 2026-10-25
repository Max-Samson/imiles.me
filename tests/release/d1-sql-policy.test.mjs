import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { automaticMigrationFindings } from '../../scripts/d1-sql-policy.mjs';

const findings = (sql) => automaticMigrationFindings([{ file: '0006_test.sql', sql }]);

test('自动 SQL 子集：简单新表、普通索引、旧表可空列，均可被真实 SQLite 执行', () => {
  const sql = `-- DROP TABLE in a comment is inert
    CREATE TABLE "sample" (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT DEFAULT 'it''s; -- not a statement',
      amount NUMERIC DEFAULT -1.5,
      extra BLOB DEFAULT NULL
    );
    /* ignore ; CREATE UNIQUE INDEX */
    CREATE INDEX sample_title ON sample (title ASC, id DESC);
    ALTER TABLE sample ADD COLUMN note TEXT;
    ALTER TABLE sample ADD another INTEGER DEFAULT NULL;
  `;
  assert.deepEqual(findings(sql), []);
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(sql);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('sample')").get().n, 6);
  } finally {
    db.close();
  }
});

test('唯一/表达式/部分索引、复杂约束、新增非空或默认值列必须人工审查', () => {
  for (const sql of [
    'CREATE UNIQUE INDEX ux ON sample(id);',
    'CREATE INDEX ix ON sample(lower(title));',
    'CREATE INDEX ix ON sample(id) WHERE id IS NOT NULL;',
    'CREATE TABLE sample(id TEXT UNIQUE);',
    'CREATE TABLE sample(id TEXT CHECK(length(id) > 0));',
    'CREATE TABLE sample(id TEXT REFERENCES users(id));',
    'CREATE TABLE sample(id TEXT, PRIMARY KEY(id));',
    'CREATE TABLE IF NOT EXISTS sample(id TEXT);',
    'CREATE TEMP TABLE sample(id TEXT);',
    'CREATE VIRTUAL TABLE sample USING fts5(title);',
    'CREATE TABLE sample AS SELECT 1;',
    'ALTER TABLE sample ADD id TEXT NOT NULL;',
    'ALTER TABLE sample ADD id TEXT DEFAULT 1;',
    'ALTER TABLE sample ADD id TEXT DEFAULT (random());',
    'ALTER TABLE sample ADD id TEXT REFERENCES other(id);',
  ])
    assert.ok(findings(sql).length, sql);
});

test('多个语句逐条检查，DML/触发器/PRAGMA/附加数据库和混合危险语句不能自动执行', () => {
  for (const sql of [
    'DROP TABLE sample;',
    'ALTER TABLE sample RENAME TO other;',
    'INSERT INTO sample VALUES (1);',
    'UPDATE sample SET id = 2;',
    'DELETE FROM sample;',
    'REPLACE INTO sample VALUES(1);',
    'PRAGMA writable_schema=1;',
    "ATTACH DATABASE 'other.db' AS other;",
    'CREATE TRIGGER tr AFTER INSERT ON sample BEGIN DELETE FROM sample; END;',
    "CREATE TABLE x(id TEXT DEFAULT 'DROP TABLE y'); DROP TABLE y;",
    'CREATE TABLE x(id TEXT); /* note */ UPDATE y SET id=1;',
    'CREATE TABLE d1_migrations(id INTEGER);',
    'CREATE INDEX sqlite_bad ON sample(id);',
    'CREATE INDEX ix ON d1_migrations(id);',
  ])
    assert.ok(findings(sql).length, sql);
});

test('词法异常、空文件、引号/注释技巧和未知类型均关闭自动执行', () => {
  for (const sql of [
    '',
    '-- comment only',
    ';;;',
    '/* unterminated',
    '/* nested /* comment */ CREATE TABLE x(id TEXT);',
    "CREATE TABLE x(id TEXT DEFAULT 'open);",
    'CREATE TABLE "open(id TEXT);',
    'CREATE TABLE x(id VARCHAR(10));',
    'CREATE TABLE x(id TEXT) WITHOUT ROWID;',
    'CREATE TABLE x(id TEXT PRIMARY KEY PRIMARY KEY);',
    'CREATE TABLE x(id TEXT);\0',
    'CREATE TABLE "x.y"(id TEXT);',
    'CREATE TABLE x(id TEXT) SELECT 1;',
  ])
    assert.ok(findings(sql).length, sql);
  assert.deepEqual(findings('CREATE TABLE [sample] (`id` INTEGER);'), []);
});
