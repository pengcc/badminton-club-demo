const DEFAULT_WEB_PORT = 3000;
const DEFAULT_API_PORT = 3003;
const SLOT_STRIDE = 10;
const MAX_TCP_PORT = 65_535;

export function parseSlotArguments(args = []) {
  const normalizedArgs = args[0] === '--' ? args.slice(1) : args;
  if (normalizedArgs.length === 0) return 0;
  if (normalizedArgs.length !== 2 || normalizedArgs[0] !== '--slot') {
    throw new Error('Usage: --slot N (N must be a non-negative integer)');
  }

  const value = normalizedArgs[1];
  if (!/^(0|[1-9]\d*)$/u.test(value)) {
    throw new Error('Development slot must be a non-negative integer');
  }

  const slot = Number(value);
  if (!Number.isSafeInteger(slot)) {
    throw new Error('Development slot is outside the supported integer range');
  }

  const { webPort, apiPort } = deriveDevelopmentSlot(slot);
  if (webPort > MAX_TCP_PORT || apiPort > MAX_TCP_PORT) {
    throw new Error(
      'Development slot derives a port outside the valid TCP range'
    );
  }
  return slot;
}

export function deriveDevelopmentSlot(slot) {
  if (!Number.isSafeInteger(slot) || slot < 0) {
    throw new Error('Development slot must be a non-negative integer');
  }

  const webPort = DEFAULT_WEB_PORT + slot * SLOT_STRIDE;
  const apiPort = DEFAULT_API_PORT + slot * SLOT_STRIDE;
  if (webPort > MAX_TCP_PORT || apiPort > MAX_TCP_PORT) {
    throw new Error(
      'Development slot derives a port outside the valid TCP range'
    );
  }

  return {
    slot,
    webPort,
    apiPort,
    webOrigin: `http://localhost:${webPort}`,
    apiOrigin: `http://localhost:${apiPort}`,
  };
}
