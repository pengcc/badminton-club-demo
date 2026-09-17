import { parseNameStatus } from '../shared/git-client.mjs';
const HIGH_RISK_PATTERNS = [
  ['scripts/', 'workflow scripts changed'],
  ['package.json', 'package configuration changed'],
  ['.github/', 'GitHub automation changed'],
  ['.repo-tools/scripts/', 'repository workflow scripts changed'],
  ['.repo-tools/config/', 'repository workflow policy changed'],
];

export function parseNumstat(text) {
  return parseNumstatEntries(text).reduce(
    (summary, entry) => ({
      added: summary.added + entry.added,
      deleted: summary.deleted + entry.deleted,
    }),
    { added: 0, deleted: 0 }
  );
}

export function parseNumstatEntries(text) {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [added, deleted, ...paths] = line.split('\t');
      return {
        path: paths.at(-1),
        added: Number.isFinite(Number(added)) ? Number(added) : 0,
        deleted: Number.isFinite(Number(deleted)) ? Number(deleted) : 0,
      };
    });
}

export function buildScopeSummary({ branch, nameStatus, numstat, diff = '' }) {
  const files = parseNameStatus(nameStatus);
  const lineEntries = parseNumstatEntries(numstat);
  const lines = lineEntries.reduce(
    (summary, entry) => ({
      added: summary.added + entry.added,
      deleted: summary.deleted + entry.deleted,
    }),
    { added: 0, deleted: 0 }
  );
  const counts = { added: 0, modified: 0, deleted: 0 };
  for (const file of files) {
    if (file.status === 'A') counts.added += 1;
    else if (file.status === 'D') counts.deleted += 1;
    else counts.modified += 1;
  }
  const highRiskHints = HIGH_RISK_PATTERNS.filter(([pattern]) =>
    files.some(
      (file) => file.path?.startsWith(pattern) || file.path === pattern
    )
  ).map(([, hint]) => hint);
  return { branch, files, counts, lines, lineEntries, highRiskHints, diff };
}

function boundedList(items, limit) {
  const shown = items.slice(0, limit);
  return `${shown.join(', ')}${items.length > limit ? `, ... (+${items.length - limit} more)` : ''}`;
}

function sortedStrings(items) {
  return [...items].sort((left, right) => left.localeCompare(right));
}

function sameStrings(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function compareScopeSummaries(
  preliminary,
  exact,
  { sampleLimit = 5 } = {}
) {
  const differences = [];
  const preliminaryFiles = new Map(
    preliminary.files.map((file) => [file.path, file.status])
  );
  const exactFiles = new Map(
    exact.files.map((file) => [file.path, file.status])
  );
  const addedPaths = sortedStrings(
    [...exactFiles.keys()]
      .filter((path) => !preliminaryFiles.has(path))
      .map((path) => `+${path}`)
  );
  const removedPaths = sortedStrings(
    [...preliminaryFiles.keys()]
      .filter((path) => !exactFiles.has(path))
      .map((path) => `-${path}`)
  );
  if (addedPaths.length || removedPaths.length) {
    differences.push(
      `File set differs: ${boundedList([...addedPaths, ...removedPaths], sampleLimit)}`
    );
  }

  const statusDifferences = sortedStrings(
    [...preliminaryFiles.entries()]
      .filter(
        ([path, status]) =>
          exactFiles.has(path) && exactFiles.get(path) !== status
      )
      .map(
        ([path, status]) =>
          `${path}: preliminary ${status}, exact ${exactFiles.get(path)}`
      )
  );
  if (statusDifferences.length) {
    differences.push(
      `Status differs: ${boundedList(statusDifferences, sampleLimit)}`
    );
  }

  if (
    preliminary.counts.added !== exact.counts.added ||
    preliminary.counts.modified !== exact.counts.modified ||
    preliminary.counts.deleted !== exact.counts.deleted
  ) {
    differences.push(
      `Classification totals differ: preliminary A${preliminary.counts.added}/M${preliminary.counts.modified}/D${preliminary.counts.deleted}, exact A${exact.counts.added}/M${exact.counts.modified}/D${exact.counts.deleted}`
    );
  }

  if (
    preliminary.lines.added !== exact.lines.added ||
    preliminary.lines.deleted !== exact.lines.deleted
  ) {
    differences.push(
      `Line summary differs: preliminary +${preliminary.lines.added}/-${preliminary.lines.deleted}, exact +${exact.lines.added}/-${exact.lines.deleted}`
    );
  }

  const preliminaryHints = sortedStrings(preliminary.highRiskHints);
  const exactHints = sortedStrings(exact.highRiskHints);
  if (!sameStrings(preliminaryHints, exactHints)) {
    differences.push(
      `High-risk hints differ: preliminary ${preliminaryHints.join('; ') || 'none'}, exact ${exactHints.join('; ') || 'none'}`
    );
  }

  return {
    matches: differences.length === 0,
    differences,
  };
}

export function renderScopeSummary(
  summary,
  output,
  { showDiff = false, heading = 'Scope summary' } = {}
) {
  output.step(heading);
  output.info(`Branch: ${summary.branch}`);
  output.info(`Changed files: ${summary.files.length}`);
  if (summary.files.length) {
    output.info(
      `Files:\n${summary.files.map((file) => `  ${file.status} ${file.path}`).join('\n')}`
    );
  }
  output.info(
    `Added: ${summary.counts.added}, Modified: ${summary.counts.modified}, Deleted: ${summary.counts.deleted}`
  );
  output.info(
    `Line summary: +${summary.lines.added} / -${summary.lines.deleted}`
  );
  if (summary.highRiskHints.length) {
    output.warning(`High-risk hints: ${summary.highRiskHints.join('; ')}`);
  } else {
    output.info('High-risk hints: none');
  }
  if (showDiff) output.info(`Full diff:\n${summary.diff || '(none)'}`);
  else
    output.skipped('Full diff hidden. Re-run with --show-diff to display it.');
}
