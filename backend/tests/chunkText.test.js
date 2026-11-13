const chunkTextByWords = require('../src/utils/chunkText');

describe('chunkTextByWords', () => {
  it('returns empty array for non-string input', () => {
    expect(chunkTextByWords(null)).toEqual([]);
    expect(chunkTextByWords(123)).toEqual([]);
  });

  it('splits text into chunks with overlap', () => {
    const text = 'one two three four five six seven eight nine ten';
    const result = chunkTextByWords(text, { chunkSize: 4, overlap: 1 });

    expect(result).toEqual([
      'one two three four',
      'four five six seven',
      'seven eight nine ten'
    ]);
  });

  it('trims and normalizes whitespace', () => {
    const text = '  one   two\nthree   ';
    const result = chunkTextByWords(text, { chunkSize: 2, overlap: 0 });

    expect(result).toEqual(['one two', 'three']);
  });

  it('throws when chunkSize is invalid', () => {
    expect(() => chunkTextByWords('one two', { chunkSize: 0 })).toThrow(
      'chunkSize must be greater than 0'
    );
  });

  it('throws when overlap is too large', () => {
    expect(() => chunkTextByWords('one two', { chunkSize: 2, overlap: 2 })).toThrow(
      'overlap must be smaller than chunkSize'
    );
  });
});
