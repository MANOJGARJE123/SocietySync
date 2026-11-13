const app = require('./app');
const env = require('./config/env');
const { connectDatabase, getConnectionTarget } = require('./config/db');

const startServer = async () => {
  try {
    await connectDatabase();
    console.log('PostgreSQL connected successfully');

    const geminiStatus = env.geminiApiKey
      ? `enabled (${String(env.geminiApiKey).length} chars)`
      : 'disabled (no GEMINI_API_KEY)';
    console.log(`Gemini status: ${geminiStatus}`);
    console.log(`Gemini chat model: ${env.geminiChatModel}`);

    app.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
    });
  } catch (error) {
    const target = getConnectionTarget();
    console.error('Failed to start server:', error.message);
    console.error('Postgres connection target:', target);
    process.exit(1);
  }
};

startServer();
