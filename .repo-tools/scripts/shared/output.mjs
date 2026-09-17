export const OUTPUT_LEVELS = [
  'STEP',
  'INFO',
  'WARNING',
  'ERROR',
  'DANGER',
  'SUCCESS',
  'SKIPPED',
  'DEBUG',
];

const OUTPUT_STYLES = {
  STEP: { color: '94', fullLine: true },
  INFO: { color: '96', fullLine: false },
  WARNING: { color: [243, 156, 18], fullLine: true },
  ERROR: { color: '91', fullLine: true },
  DANGER: { color: '91', fullLine: true },
  SUCCESS: { color: '32', fullLine: false },
  SKIPPED: { color: [221, 151, 108], fullLine: true },
  DEBUG: { color: '90', fullLine: false },
};

function ansiColor(color) {
  return Array.isArray(color) ? `38;2;${color.join(';')}` : color;
}

const COMMAND_COLOR = [28, 112, 230];

export function createOutput({
  stdout = process.stdout,
  stderr = process.stderr,
  verbose = false,
  env = process.env,
} = {}) {
  let hasActiveStep = false;
  const streamFor = (level) =>
    ['ERROR', 'DANGER', 'WARNING'].includes(level) ? stderr : stdout;
  const format = (level, message, stream = streamFor(level)) => {
    const label = `[${level}]`;
    let rendered;
    if (!stream.isTTY || env.NO_COLOR !== undefined)
      rendered = `${label} ${message}`;
    else {
      const style = OUTPUT_STYLES[level];
      const color = ansiColor(style.color);
      const coloredLabel = `\u001B[1;${color}m${label}`;
      rendered = style.fullLine
        ? `${coloredLabel}\u001B[22m ${message}\u001B[0m`
        : `${coloredLabel}\u001B[0m ${message}`;
    }
    if (
      ['STEP', 'ERROR', 'DANGER', 'WARNING'].includes(level) ||
      !hasActiveStep
    )
      return rendered;
    return rendered
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');
  };
  const write = (level, message) => {
    if (level === 'DEBUG' && !verbose) return;
    const stream = streamFor(level);
    stream.write(`${format(level, message, stream)}\n`);
    if (level === 'STEP') hasActiveStep = true;
  };
  const command = (label, commandText) => {
    const stream = streamFor('INFO');
    const styledCommand =
      stream.isTTY && env.NO_COLOR === undefined
        ? `\u001B[${ansiColor(COMMAND_COLOR)}m${commandText}\u001B[0m`
        : commandText;
    stream.write(`${format('INFO', `${label} ${styledCommand}`, stream)}\n`);
  };

  return Object.fromEntries([
    ...OUTPUT_LEVELS.map((level) => [
      level.toLowerCase(),
      (message) => write(level, message),
    ]),
    ['command', command],
    ['write', write],
    ['format', format],
  ]);
}
