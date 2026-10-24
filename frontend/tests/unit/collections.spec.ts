import { describe, expect, it } from 'vitest';

import { elements } from '../../src/shared/utils/collections';

describe('shared/utils/collections', () => {
  it('laisse un tableau nu tel quel', () => {
    expect(elements([{ id: 'a' }])).toEqual([{ id: 'a' }]);
  });

  it('déballe l’enveloppe paginée', () => {
    expect(elements({ data: [{ id: 'a' }], total: 1, page: 1, pageSize: 50 })).toEqual([{ id: 'a' }]);
  });

  it('renvoie un tableau vide quand la réponse est vide', () => {
    expect(elements(undefined)).toEqual([]);
    expect(elements(null)).toEqual([]);
  });
});
