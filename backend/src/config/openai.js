const OpenAI = require('openai');
const env = require('./env');

const openaiClient = new OpenAI({ apiKey: env.openaiApiKey });

module.exports = openaiClient;
