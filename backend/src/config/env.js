const dotenv = require('dotenv');
dotenv.config();

const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  postgresUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  openaiApiKey: process.env.OPENAI_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  openaiChatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
  openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  geminiChatModel: process.env.GEMINI_CHAT_MODEL || 'gemini-1.5-flash',
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
  topKResults: Number(process.env.TOP_K_RESULTS || 3),
  ragMinSimilarity: Number(process.env.RAG_MIN_SIMILARITY || 0.35),
  chunkSizeWords: Number(process.env.CHUNK_SIZE_WORDS || 300),
  chunkOverlapWords: Number(process.env.CHUNK_OVERLAP_WORDS || 50),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim()),
};

const hasPgEnvFallback = Boolean(process.env.PGHOST || process.env.PGUSER || process.env.PGDATABASE);
if (!env.postgresUrl && !hasPgEnvFallback) {
  throw new Error('Missing database config: set DATABASE_URL or PG* env vars');
}
if (!env.jwtSecret) throw new Error('Missing required env: JWT_SECRET');
if (env.jwtSecret.length < 32) {
  console.warn('[SECURITY] JWT_SECRET is shorter than 32 chars — use a longer secret in production');
}

module.exports = env;
