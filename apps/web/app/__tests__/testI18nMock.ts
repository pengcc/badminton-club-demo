import dashboardMessages from '../../messages/en/dashboard.json';

type Values = Record<string, string | number | boolean | null | undefined>;

function resolveMessage(key: string): string {
  let value: unknown = dashboardMessages;

  for (const segment of key.split('.')) {
    value = (value as Record<string, unknown> | undefined)?.[segment];
  }

  if (typeof value !== 'string') return key;
  return value;
}

export function dashboardTranslator(namespace = 'dashboard.cms') {
  const prefix = namespace.replace(/^dashboard\.?/, '');

  return (key: string, values: Values = {}) =>
    Object.entries(values).reduce(
      (message, [name, value]) =>
        message.replaceAll(
          `{${name}}`,
          value === undefined ? '' : String(value)
        ),
      resolveMessage(prefix ? `${prefix}.${key}` : key)
    );
}
