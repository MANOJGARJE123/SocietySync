const env = require('../config/env');
const fetchClient = require('./fetchClient');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

let cachedChatModel = null;
let resolveAttempted = false;

const normalizeModelName = (name) => String(name || '').replace(/^models\//, '');

const supportsGenerateContent = (model) => {
  const methods =
    model?.supportedGenerationMethods ||
    model?.supported_generation_methods ||
    model?.supportedMethods ||
    [];
  return Array.isArray(methods) && methods.includes('generateContent');
};

const isEmbeddingModel = (modelName) => /embedding/i.test(modelName);

const pickChatModel = (models, preferred) => {
  const candidates = models
    .map((model) => {
      const name = normalizeModelName(model.name);
      const base = normalizeModelName(model.baseModelId || model.name);
      return {
        name,
        base,
        supports: supportsGenerateContent(model)
      };
    })
    .filter((model) => model.supports)
    .filter((model) => !isEmbeddingModel(model.base));

  if (candidates.length === 0) return null;

  const normalizedPreferred = preferred
    .filter(Boolean)
    .map((modelName) => normalizeModelName(modelName));

  for (const preferredName of normalizedPreferred) {
    const match = candidates.find(
      (candidate) => candidate.base === preferredName || candidate.name === preferredName
    );
    if (match) return match.base;
  }

  return candidates[0].base;
};

const resolveGeminiChatModel = async () => {
  if (cachedChatModel) return cachedChatModel;
  if (resolveAttempted) return env.geminiChatModel;
  resolveAttempted = true;

  if (!env.geminiApiKey) return null;

  try {
    const response = await fetchClient(`${GEMINI_BASE_URL}/models?key=${env.geminiApiKey}`);
    if (!response.ok) {
      return env.geminiChatModel;
    }

    const data = await response.json();
    const models = Array.isArray(data?.models) ? data.models : [];
    const preferred = [
      env.geminiChatModel,
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ];
    const selected = pickChatModel(models, preferred);

    cachedChatModel = selected || env.geminiChatModel;
    if (selected && selected !== env.geminiChatModel) {
      console.warn(`Gemini chat model resolved to "${selected}" (from "${env.geminiChatModel}").`);
    }
    return cachedChatModel;
  } catch (error) {
    return env.geminiChatModel;
  }
};

module.exports = resolveGeminiChatModel;
