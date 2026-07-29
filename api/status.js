const { connectToDatabase } = require('./lib/db');
const { requireSession } = require('./lib/auth');

module.exports = async (req, res) => {
  if (!requireSession(req, res)) return;

  try {
    const db = await connectToDatabase();
    // Test a basic ping command
    await db.command({ ping: 1 });

    res.status(200).json({
      status: 'ok',
      serverless: true,
      database: 'connected',
      isAdmin: true,
      profile: {
        name: process.env.PROFILE_NAME || 'SocialFeed Owner',
        email: process.env.PROFILE_EMAIL || 'Private account',
        memberSince: process.env.MEMBER_SINCE || 'Private account'
      },
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
