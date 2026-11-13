const cosineSimilarity = require('../src/utils/cosineSimilarity');

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const result = cosineSimilarity([1, 2, 3], [1, 2, 3]);
    expect(result).toBeCloseTo(1, 6);
  });

  it('returns 0 for orthogonal vectors', () => {
    const result = cosineSimilarity([1, 0], [0, 1]);
    expect(result).toBeCloseTo(0, 6);
  });

  it('returns 0 for invalid vectors', () => {
    const result = cosineSimilarity([1, 2], [1]);
    expect(result).toBe(0);
  });
});
