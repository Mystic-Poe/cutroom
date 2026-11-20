'use strict';
// One argument reader shared by the guard and the cutroom bins, so they can
// never disagree about which words are file paths.
//
// Rule: an optional single leading `--` is dropped; every other word is a
// path. A path starting with `-` is refused (write it as ./-name instead), so
// nothing can hide from the guard by looking like a flag.

function operands(args) {
  const a = args[0] === '--' ? args.slice(1) : args.slice();
  const bad = a.find((x) => x.startsWith('-'));
  if (bad !== undefined) {
    const err = new Error(`"${bad}" looks like an option. cutroom tools take only file paths; write a file starting with "-" as ./${bad}.`);
    err.code = 'CUTROOM_ARGS';
    throw err;
  }
  return a;
}

module.exports = { operands };
