const DIMENSIONS = 256;

const hashToken = (token) => {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
};

const buildLocalEmbedding = (text) => {
  const vector = new Array(DIMENSIONS).fill(0);
  const tokens = String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);

  for (const token of tokens) {
    const index = hashToken(token) % DIMENSIONS;
    vector[index] += 1;
  }

  let magnitude = 0;
  for (let i = 0; i < vector.length; i += 1) {
    magnitude += vector[i] * vector[i];
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude === 0) return vector;

  for (let i = 0; i < vector.length; i += 1) {
    vector[i] /= magnitude;
  }

  return vector;
};

module.exports = buildLocalEmbedding;
