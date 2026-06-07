#!/usr/bin/env node
/**
 * PreToolUse hook for Grep.
 *
 * Redirects symbol-style Grep searches to CodeGraph, which answers structural
 * questions (where defined, callers, callees, impact) from a full AST index —
 * faster and more accurate than text search.
 *
 * It only intervenes when the Grep pattern looks like a bare identifier or a
 * definition-style query ("function Foo", "class Bar"). Anything with spaces,
 * dots, slashes, quotes, or regex metacharacters is treated as a genuine
 * literal-text search and passed through untouched.
 */

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let data = {};
  try {
    data = JSON.parse(raw || '{}');
  } catch {
    process.exit(0); // never break the tool call on parse failure
  }

  const input = data.tool_input || {};
  const pattern = typeof input.pattern === 'string' ? input.pattern.trim() : '';
  if (!pattern) process.exit(0);

  // Strip leading/trailing \b word boundaries so "\bFoo\b" still counts as bare.
  const stripped = pattern.replace(/^\\b/, '').replace(/\\b$/, '');

  const isBareIdentifier = /^[A-Za-z_$][A-Za-z0-9_$]{1,}$/.test(stripped);
  const isDefinitionStyle =
    /^(function|class|interface|type|const|let|var|enum)\s+[A-Za-z_$][A-Za-z0-9_$]*$/.test(pattern);

  if (!isBareIdentifier && !isDefinitionStyle) {
    process.exit(0); // looks like real literal-text search — allow it
  }

  const reason = [
    'CodeGraph is initialized for this project and is the better tool for this lookup.',
    `Grep was used for the symbol-like pattern \`${pattern}\`, which is a structural query.`,
    '',
    'Use one of these instead (sub-millisecond, AST-accurate):',
    '- codegraph_search   -> where the symbol is defined (kind + location + signature)',
    '- codegraph_callers  -> what calls it',
    '- codegraph_callees  -> what it calls',
    '- codegraph_impact   -> what would break if you change it',
    '- codegraph_context  -> focused context for the whole area in one call',
    '',
    'If you truly need literal-text occurrences (a comment, string content, or log message),',
    're-run Grep with a phrase or regex that is not a bare identifier.',
  ].join('\n');

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
});
