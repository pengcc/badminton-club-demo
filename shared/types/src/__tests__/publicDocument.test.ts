import { describe, expect, it } from 'vitest';
import { Language } from '../core/enums';
import {
  publicDocumentCreateMutationSchema,
  publicDocumentReorderSchema,
  publicDocumentUpdateMutationSchema,
  resolvePublicDocumentName,
} from '../api/publicDocument';

const content = {
  displayName: { de: 'Satzung', en: '', zh: '' },
  documentDate: '2012-06-09',
  isVisible: true,
};

describe('Public Document collection contract', () => {
  it('keeps create separate from retained file ownership', () => {
    expect(
      publicDocumentCreateMutationSchema.parse({ document: content })
    ).toEqual({ document: content });
    expect(
      publicDocumentCreateMutationSchema.safeParse({
        document: { ...content, retainedFile: '/documents/statutes.pdf' },
      }).success
    ).toBe(false);
    expect(
      publicDocumentUpdateMutationSchema.parse({
        document: { ...content, retainedFile: '/documents/statutes.pdf' },
      })
    ).toEqual({
      document: { ...content, retainedFile: '/documents/statutes.pdf' },
    });
  });

  it('requires German display copy and an ISO document date', () => {
    expect(
      publicDocumentCreateMutationSchema.safeParse({
        document: { ...content, documentDate: '2012' },
      }).success
    ).toBe(false);
    expect(
      resolvePublicDocumentName(content.displayName, Language.ENGLISH)
    ).toBe('Satzung');
  });

  it('accepts complete order lists without a product count cap', () => {
    const ids = Array.from({ length: 10 }, (_, index) =>
      index.toString(16).padStart(24, '0')
    );
    expect(publicDocumentReorderSchema.parse({ ids })).toEqual({ ids });
    expect(
      publicDocumentReorderSchema.safeParse({ ids: ['bad-id'] }).success
    ).toBe(false);
  });
});
