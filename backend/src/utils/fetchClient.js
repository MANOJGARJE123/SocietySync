let fetchClient = typeof fetch === 'function' ? fetch : null;

if (!fetchClient) {
  try {
    // node-fetch is a lightweight fallback for Node < 18.
    fetchClient = require('node-fetch');
  } catch (error) {
    throw new Error('Fetch API is not available. Use Node 18+ or install node-fetch.');
  }
}

module.exports = fetchClient;
