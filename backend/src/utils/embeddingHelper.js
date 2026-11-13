const env = require('../config/env');
const fetchClient = require('./fetchClient');
const buildLocalEmbedding = require('./localEmbedding');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Utils layer: creates embeddings and keeps Gemini call details reusable.
const generateEmbedding = async (input) => {
  if (!env.geminiApiKey) {
    return buildLocalEmbedding(input);
  }

  let response;
  try {
    response = await fetchClient(
      `${GEMINI_BASE_URL}/models/${env.geminiEmbeddingModel}:embedContent?key=${env.geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: {
            parts: [{ text: input }]
          }
        })
      }
    );
  } catch (error) {
    return buildLocalEmbedding(input);
  }

  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    return buildLocalEmbedding(input);
  }

  if (!response.ok) {
    return buildLocalEmbedding(input);
  }

  const embedding = data?.embedding?.values;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    return buildLocalEmbedding(input);
  }

  return embedding;
};

module.exports = generateEmbedding;
