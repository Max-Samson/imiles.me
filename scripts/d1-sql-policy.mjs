/**
 * 自动发布只接受下面显式实现的小型 SQL 语法，不靠“未命中危险关键字”推断安全。
 * 这不是通用 SQLite 解析器：合法但超出范围的 SQL 仍需人工计划审批。
 */
function tokenize(sql) {
  if (sql.includes('\0')) throw new Error('SQL 不能包含 NUL');
  const tokens = [];
  let offset = 0;
  while (offset < sql.length) {
    const rest = sql.slice(offset);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) {
      offset += whitespace[0].length;
      continue;
    }
    if (rest.startsWith('--')) {
      const end = rest.indexOf('\n');
      offset += end < 0 ? rest.length : end + 1;
      continue;
    }
    if (rest.startsWith('/*')) {
      const end = rest.indexOf('*/', 2);
      if (end < 0 || rest.slice(2, end).includes('/*')) throw new Error('注释未闭合或嵌套');
      offset += end + 2;
      continue;
    }
    const quote = rest[0];
    if (["'", '"', '`', '['].includes(quote)) {
      const close = quote === '[' ? ']' : quote;
      let value = '';
      let end = 1;
      let closed = false;
      for (; end < rest.length; end++) {
        if (rest[end] !== close) value += rest[end];
        else if (quote !== '[' && rest[end + 1] === close) {
          value += close;
          end++;
        } else {
          closed = true;
          end++;
          break;
        }
      }
      if (!closed) throw new Error('引号未闭合');
      tokens.push({ type: quote === "'" ? 'literal' : 'identifier', value });
      offset += end;
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (word) {
      tokens.push({ type: 'word', value: word[0] });
      offset += word[0].length;
      continue;
    }
    const number = /^-?\d+(?:\.\d+)?/.exec(rest);
    if (number) {
      tokens.push({ type: 'number', value: number[0] });
      offset += number[0].length;
      continue;
    }
    if ('(),;'.includes(quote)) {
      tokens.push({ type: 'punctuation', value: quote });
      offset++;
      continue;
    }
    throw new Error('包含自动语法范围之外的符号');
  }
  return tokens;
}

function automaticStatement(tokens) {
  let cursor = 0;
  const word = (value) => {
    const token = tokens[cursor];
    if (token?.type !== 'word' || token.value.toUpperCase() !== value) return false;
    cursor++;
    return true;
  };
  const punctuation = (value) => {
    if (tokens[cursor]?.type !== 'punctuation' || tokens[cursor].value !== value) return false;
    cursor++;
    return true;
  };
  const identifier = () => {
    const token = tokens[cursor];
    if (
      !token ||
      !['word', 'identifier'].includes(token.type) ||
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(token.value) ||
      /^(?:sqlite_|d1_migrations$)/i.test(token.value)
    )
      return false;
    cursor++;
    return true;
  };
  const type = () => ['TEXT', 'INTEGER', 'REAL', 'BLOB', 'NUMERIC'].some(word);
  const defaultValue = () => {
    if (word('NULL')) return true;
    if (!['literal', 'number'].includes(tokens[cursor]?.type)) return false;
    cursor++;
    return true;
  };
  const column = () => {
    if (!identifier() || !type()) return false;
    // 新表允许简单列约束；不自动接收 CHECK/FK/UNIQUE/表达式和表级约束。
    const seen = new Set();
    while (tokens[cursor]?.type === 'word') {
      const constraint = tokens[cursor].value.toUpperCase();
      if (seen.has(constraint)) return false;
      seen.add(constraint);
      if (word('PRIMARY')) {
        if (!word('KEY')) return false;
      } else if (word('NOT')) {
        if (!word('NULL')) return false;
      } else if (word('DEFAULT')) {
        if (!defaultValue()) return false;
      } else return false;
    }
    return true;
  };
  if (word('CREATE')) {
    if (word('TABLE')) {
      if (!identifier() || !punctuation('(') || !column()) return false;
      while (punctuation(',')) if (!column()) return false;
      return punctuation(')') && cursor === tokens.length;
    }
    if (word('INDEX')) {
      if (!identifier() || !word('ON') || !identifier() || !punctuation('(')) return false;
      do {
        if (!identifier()) return false;
        if (!word('ASC')) word('DESC');
      } while (punctuation(','));
      return punctuation(')') && cursor === tokens.length;
    }
    return false;
  }
  if (word('ALTER') && word('TABLE') && identifier() && word('ADD')) {
    word('COLUMN');
    if (!identifier() || !type()) return false;
    // 旧表只自动增加可空、无数据回填的列，DEFAULT 仅允许 NULL。
    if (word('DEFAULT') && !word('NULL')) return false;
    return cursor === tokens.length;
  }
  return false;
}

export function automaticMigrationFindings(entries) {
  const findings = [];
  for (const { file, sql } of entries) {
    try {
      const statements = [[]];
      for (const token of tokenize(sql)) {
        if (token.type === 'punctuation' && token.value === ';') statements.push([]);
        else statements.at(-1).push(token);
      }
      const nonempty = statements.filter((statement) => statement.length);
      if (!nonempty.length) throw new Error('没有可执行语句');
      for (const [index, statement] of nonempty.entries()) {
        if (!automaticStatement(statement)) {
          findings.push({ file, statement: index + 1, rule: 'outside-automatic-sql-subset' });
        }
      }
    } catch {
      // 词法未知不是“安全”；不能忽略剩余文本后继续执行。
      findings.push({ file, rule: 'unrecognized-sql' });
    }
  }
  return findings;
}
