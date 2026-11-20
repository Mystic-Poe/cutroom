'use strict';
// A small, best-effort shell command parser for the guard.
//
// It is not a full shell. It is built to catch honest mistakes: it splits a
// command line into simple commands, sees inside $( ), backticks, <( ) and
// `bash -c "..."`, strips harmless wrappers (env, nohup, time, ...), and
// records redirection targets. Claude Code's own permission system stays as
// the second layer behind it.

const OPS = ['&&', '||', '|&', ';;', '|', ';', '&', '\n'];
const REDIRECTS = ['&>>', '&>', '2>>', '2>', '1>>', '1>', '>>', '>|', '>', '<<<', '<<', '<'];

/** Tokenize into words, operators and redirections; collects substitutions. */
function tokenize(src) {
  const tokens = [];
  const subs = []; // raw text of $( ), ` `, <( ), >( ) bodies
  let i = 0;
  let word = null; // current word text, or null when between words
  let wordSubs = [];

  const flush = () => {
    if (word !== null) {
      tokens.push({ type: 'word', value: word, subs: wordSubs });
      word = null;
      wordSubs = [];
    }
  };
  const addSub = (body) => {
    subs.push(body);
    wordSubs.push(body);
  };

  // read a balanced $( ... ) or <( ... ) body starting after the open paren
  const readParen = () => {
    let depth = 1;
    let start = i;
    let q = null;
    while (i < src.length) {
      const c = src[i];
      if (q) {
        if (c === '\\' && q === '"') i++;
        else if (c === q) q = null;
      } else if (c === "'" || c === '"') q = c;
      else if (c === '(') depth++;
      else if (c === ')') {
        depth--;
        if (depth === 0) {
          const body = src.slice(start, i);
          i++;
          return body;
        }
      }
      i++;
    }
    return src.slice(start);
  };
  const readBacktick = () => {
    const start = i;
    while (i < src.length && src[i] !== '`') {
      if (src[i] === '\\') i++;
      i++;
    }
    const body = src.slice(start, i);
    i++;
    return body;
  };

  while (i < src.length) {
    const c = src[i];

    if (c === '\\' && i + 1 < src.length) {
      if (src[i + 1] === '\n') {
        i += 2;
        continue;
      }
      word = (word ?? '') + src[i + 1];
      i += 2;
      continue;
    }
    if (c === '#' && word === null) {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      flush();
      i++;
      continue;
    }
    if (c === '$' && src[i + 1] === "'") {
      // $'...' ANSI-C quoting, decoded as bash does. An escape we don't know
      // becomes a \u0000 marker, which makes the word unreadable (→ ask).
      let j = i + 2;
      let buf = '';
      const SIMPLE = { a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\', "'": "'", '"': '"', '?': '?' };
      while (j < src.length && src[j] !== "'") {
        if (src[j] !== '\\' || j + 1 >= src.length) {
          buf += src[j++];
          continue;
        }
        const rest = src.slice(j + 1);
        let m;
        if (SIMPLE[rest[0]] !== undefined) {
          buf += SIMPLE[rest[0]];
          j += 2;
        } else if ((m = /^x([0-9a-fA-F]{1,2})/.exec(rest))) {
          buf += String.fromCharCode(parseInt(m[1], 16));
          j += 1 + m[0].length;
        } else if ((m = /^u([0-9a-fA-F]{1,4})/.exec(rest)) || (m = /^U([0-9a-fA-F]{1,8})/.exec(rest))) {
          const cp = parseInt(m[1], 16);
          buf += cp <= 0x10ffff ? String.fromCodePoint(cp) : '\u0000';
          j += 1 + m[0].length;
        } else if ((m = /^([0-7]{1,3})/.exec(rest))) {
          buf += String.fromCharCode(parseInt(m[1], 8) & 0xff);
          j += 1 + m[0].length;
        } else if ((m = /^c(.)/.exec(rest))) {
          buf += String.fromCharCode(m[1].toUpperCase().charCodeAt(0) ^ 0x40);
          j += 1 + m[0].length;
        } else {
          buf += '\u0000';
          j += 2;
        }
      }
      word = (word ?? '') + buf;
      i = j + 1;
      continue;
    }
    if (c === "'") {
      const end = src.indexOf("'", i + 1);
      const stop = end === -1 ? src.length : end;
      word = (word ?? '') + src.slice(i + 1, stop);
      i = stop + 1;
      continue;
    }
    if (c === '"') {
      i++;
      let buf = '';
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\' && i + 1 < src.length) {
          buf += src[i + 1];
          i += 2;
        } else if (src[i] === '$' && src[i + 1] === '(') {
          i += 2;
          const body = readParen();
          addSub(body);
          buf += `$(${body})`;
        } else if (src[i] === '`') {
          i++;
          const body = readBacktick();
          addSub(body);
          buf += '`' + body + '`';
        } else {
          buf += src[i++];
        }
      }
      i++;
      word = (word ?? '') + buf;
      continue;
    }
    if (c === '$' && src[i + 1] === '(') {
      i += 2;
      const body = readParen();
      addSub(body);
      word = (word ?? '') + `$(${body})`;
      continue;
    }
    if (c === '`') {
      i++;
      const body = readBacktick();
      addSub(body);
      word = (word ?? '') + '`' + body + '`';
      continue;
    }
    if ((c === '<' || c === '>') && src[i + 1] === '(') {
      flush();
      i += 2;
      const body = readParen();
      addSub(body);
      tokens.push({ type: 'word', value: `${c}(${body})`, subs: [body] });
      continue;
    }
    // redirections are recognised anywhere outside quotes, even mid-word (x>file)
    const op = REDIRECTS.find((r) => src.startsWith(r, i));
    if (op && !(op === '<' && src[i + 1] === '(')) {
      if (word !== null && /^\d+$/.test(word)) word = null; // fd number like 2>
      flush();
      i += op.length;
      tokens.push({ type: 'redir', value: op });
      continue;
    }
    const sep = OPS.find((o) => src.startsWith(o, i));
    if (sep) {
      flush();
      i += sep.length;
      tokens.push({ type: 'op', value: sep });
      continue;
    }
    if (c === '(' || c === ')' || c === '{' || c === '}') {
      if (word === null) {
        // subshell / group grouping: treat as separator
        flush();
        tokens.push({ type: 'op', value: ';' });
        i++;
        continue;
      }
    }
    word = (word ?? '') + c;
    i++;
  }
  flush();
  return { tokens, subs };
}

const WRAPPERS = new Set(['env', 'command', 'builtin', 'exec', 'nohup', 'time', 'caffeinate', 'nice', 'timeout', 'stdbuf', 'unbuffer']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'fish', 'ksh']);

function base(cmd) {
  const s = cmd.split('/');
  return s[s.length - 1];
}

/** Drop env assignments and wrapper commands from the front of a word list. */
function stripWrappers(words) {
  let w = words.slice();
  for (;;) {
    while (w.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0])) w.shift();
    if (!w.length) return w;
    const b = base(w[0]);
    if (!WRAPPERS.has(b)) return w;
    w.shift();
    // skip the wrapper's own flags and numeric args (timeout 10, nice -n 5)
    while (w.length && (w[0].startsWith('-') || /^\d+[smhd]?$/.test(w[0]))) {
      const f = w.shift();
      if ((b === 'nice' && f === '-n') || (b === 'stdbuf' && f.length === 2)) w.shift();
    }
  }
}

/**
 * Parse a command line into simple commands.
 * Each: { cmd, args, redirects: [{op, target}], pipeIndex, pipePos, inner }
 *  - pipeIndex groups the commands of one pipeline; pipePos is the position in it
 *  - inner: true when it came from a substitution or `bash -c` string
 */
function segments(src, depth = 0, inner = false) {
  const out = [];
  if (depth > 6 || typeof src !== 'string') return out;
  const { tokens } = tokenize(src);
  let words = [];
  let wordSubs = [];
  let redirects = [];
  let pipeIndex = 0;
  let pipePos = 0;
  let pendingRedir = null;

  const end = () => {
    const stripped = stripWrappers(words);
    if (stripped.length) {
      const seg = {
        cmd: base(stripped[0]),
        path: stripped[0],
        args: stripped.slice(1),
        redirects,
        pipeIndex,
        pipePos,
        inner,
        subs: wordSubs,
      };
      out.push(seg);
      // xargs runs another command: expose it as its own segment
      if (seg.cmd === 'xargs') {
        let a = seg.args.slice();
        while (a.length && a[0].startsWith('-')) {
          const f = a.shift();
          if (/^-(I|n|L|P|s|d|E)$/.test(f)) a.shift();
        }
        if (a.length) out.push({ ...seg, cmd: base(a[0]), path: a[0], args: a.slice(1), inner: true, subs: [] });
      }
      // sh -c "...", bash -c "...", eval "...": parse the inner string
      if ((SHELLS.has(seg.cmd) && seg.args.includes('-c')) || seg.cmd === 'eval') {
        const body = seg.cmd === 'eval' ? seg.args.join(' ') : seg.args[seg.args.indexOf('-c') + 1];
        if (body) out.push(...segments(body, depth + 1, true));
      }
    }
    for (const s of wordSubs) out.push(...segments(s, depth + 1, true));
    words = [];
    wordSubs = [];
    redirects = [];
  };

  for (const t of tokens) {
    if (pendingRedir) {
      if (t.type === 'word') {
        redirects.push({ op: pendingRedir, target: t.value });
        wordSubs.push(...t.subs);
        pendingRedir = null;
        continue;
      }
      pendingRedir = null;
    }
    if (t.type === 'word') {
      words.push(t.value);
      wordSubs.push(...t.subs);
    } else if (t.type === 'redir') {
      pendingRedir = t.value;
    } else if (t.type === 'op') {
      end();
      if (t.value === '|' || t.value === '|&') pipePos++;
      else {
        pipeIndex++;
        pipePos = 0;
      }
    }
  }
  end();
  return out;
}

module.exports = { tokenize, segments, stripWrappers, SHELLS };
