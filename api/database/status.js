const { connectToDatabase } = require('../lib/db');
const { requireSession } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireSession(req, res)) return;
  try {
    const db = await connectToDatabase();
    await db.command({ ping: 1 });
    return res.status(200).json({ status: 'ok', database: 'connected', time: new Date().toISOString() });
  } catch (error) {
    console.error('Database readiness check failed:', error);
    return res.status(503).json({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Bookmarks are temporarily unavailable.',
        retryable: true
      }
    });
  }
};
