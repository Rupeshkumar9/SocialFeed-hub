const { connectToDatabase } = require('./lib/db');
const { requireSession } = require('./lib/auth');
const { getUserById, publicUser } = require('./lib/users');

module.exports = async (req, res) => {
  if (!requireSession(req, res)) return;

  try {
    const db = await connectToDatabase();
    // Test a basic ping command
    await db.command({ ping: 1 });

    const user = await getUserById(req.auth.userId);
    if (!user) return res.status(401).json({ error: 'Session expired.' });
    res.status(200).json({
      status: 'ok',
      serverless: true,
      database: 'connected',
      isAdmin: true,
      profile: { ...publicUser(user), name: user.displayName },
      time: new Date()
    });
  } catch (err) {
    console.error('Database connection failed inside status check:', err);
    res.status(500).json({
      status: 'error',
      serverless: true,
      database: 'disconnected',
      error: err.message
    });
  }
};
