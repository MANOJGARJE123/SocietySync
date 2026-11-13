// Utils layer: reusable text chunking helper for RAG ingestion.
const chunkTextByWords = (text, options = {}) => {
  const chunkSize = Number(options.chunkSize ?? 300);
  const overlap = Number(options.overlap ?? 50);

  if (!text || typeof text !== 'string') {
    return [];
  }

  const words = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  if (words.length === 0) {
    return [];
  }

  if (chunkSize <= 0) {
    throw new Error('chunkSize must be greater than 0');
  }

  if (overlap >= chunkSize) {
    throw new Error('overlap must be smaller than chunkSize');
  }

  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunkWords = words.slice(start, end);
    chunks.push(chunkWords.join(' '));

    if (end === words.length) {
      break;
    }

    start += chunkSize - overlap;
  }

  return chunks;
};

module.exports = chunkTextByWords;
