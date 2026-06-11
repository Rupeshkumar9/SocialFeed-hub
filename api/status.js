const { connectToDatabase } = require('./lib/db');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const db = await connectToDatabase();
    // Test a basic ping command
    await db.command({ ping: 1 });

    // Check if the user is authenticated as admin
    let isAdmin = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (process.env.ADMIN_PASSWORD && token === process.env.ADMIN_PASSWORD) {
        isAdmin = true;
      }
    }
    
    res.status(200).json({
      status: 'ok',
      serverless: true,
      database: 'connected',
      isAdmin: isAdmin,
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
