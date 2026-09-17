import { describe, expect, it } from 'vitest';
import { BankingCryptoService } from '../../services/bankingCryptoService';

const key = (byte: number) => Buffer.alloc(32, byte).toString('base64');
const banking = {
  accountHolderType: 'different' as const,
  accountHolderFirstName: 'Ada',
  accountHolderLastName: 'Lovelace',
  accountHolderAddress: 'Test 1, 10115 Berlin',
  bankName: 'Test Bank',
  iban: 'DE02120300000000202051',
  bic: 'BYLADEM1001',
  debitFrequency: 'quarterly' as const,
};

describe('BankingCryptoService', () => {
  const service = new BankingCryptoService({
    activeKeyVersion: 'v2',
    keys: { v1: key(1), v2: key(2) },
  });

  it('round trips by persisted key version and uses a fresh nonce', () => {
    const first = service.encrypt(
      banking,
      'membership-application',
      'application-1'
    );
    const second = service.encrypt(
      banking,
      'membership-application',
      'application-1'
    );
    expect(first.keyVersion).toBe('v2');
    expect(first.nonce).not.toBe(second.nonce);
    expect(
      service.decrypt(first, 'membership-application', 'application-1')
    ).toEqual(banking);
  });

  it('reports configured key-version availability without exposing key material', () => {
    expect(service.hasKeyVersion('v1')).toBe(true);
    expect(service.hasKeyVersion('v2')).toBe(true);
    expect(service.hasKeyVersion('missing')).toBe(false);
  });

  it('fails closed for tampering, wrong owner/purpose, and missing versions', () => {
    const envelope = service.encrypt(
      banking,
      'membership-application',
      'application-1'
    );
    const replacement = envelope.ciphertext[0] === 'A' ? 'B' : 'A';
    expect(() =>
      service.decrypt(
        {
          ...envelope,
          ciphertext: `${replacement}${envelope.ciphertext.slice(1)}`,
        },
        'membership-application',
        'application-1'
      )
    ).toThrow();
    expect(() =>
      service.decrypt(envelope, 'membership-application', 'application-2')
    ).toThrow();
    expect(() =>
      service.decrypt(envelope, 'member-banking-profile', 'application-1')
    ).toThrow();
    expect(() =>
      service.decrypt(
        { ...envelope, keyVersion: 'missing' },
        'membership-application',
        'application-1'
      )
    ).toThrow('key version');
  });
});
