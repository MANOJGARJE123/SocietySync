const db = require('../config/db');
const env = require('../config/env');
const cosineSimilarity = require('../utils/cosineSimilarity');

const normalizeEmbedding = (rawEmbedding) => {
  if (!rawEmbedding) return [];

  if (Array.isArray(rawEmbedding)) {
    return rawEmbedding;
  }

  if (typeof rawEmbedding === 'string') {
    try {
      const parsed = JSON.parse(rawEmbedding);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  // Some drivers can return JSONB as objects with numeric keys.
  if (typeof rawEmbedding === 'object') {
    const values = Object.values(rawEmbedding)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    return values;
  }

  return [];
};

// Repository layer: encapsulates all persistence-related operations.
const ragRepository = {
  async insertManyChunks(chunks) {
    if (!Array.isArray(chunks) || chunks.length === 0) return [];

    const values = [];
    const params = [];
    let paramIndex = 1;

    for (const chunk of chunks) {
      values.push(`($${paramIndex++}, $${paramIndex++})`);
      params.push(chunk.text);
      params.push(JSON.stringify(chunk.embedding));
    }

    const result = await db.query(
      `
        INSERT INTO rag_chunks (text, embedding)
        VALUES ${values.join(', ')}
        RETURNING id, text, embedding, created_at
      `,
      params
    );

    return result.rows.map((row) => ({
      _id: row.id,
      id: row.id,
      text: row.text,
      embedding: row.embedding,
      createdAt: row.created_at
    }));
  },

  async countChunks() {
    const result = await db.query('SELECT COUNT(*)::int as count FROM rag_chunks');
    return result.rows[0]?.count ?? 0;
  },

  async findTopSimilarChunks(queryEmbedding, topK = env.topKResults) {
    const result = await db.query('SELECT id, text, embedding FROM rag_chunks');
    const ranked = result.rows
      .map((row) => {
        const embedding = normalizeEmbedding(row.embedding);

        return {
          _id: row.id,
          id: row.id,
          text: row.text,
          embedding,
          score: cosineSimilarity(queryEmbedding, embedding)
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return ranked;
  }
};

module.exports = ragRepository;
