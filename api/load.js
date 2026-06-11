const { connectToDatabase } = require('./lib/db');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Use GET.' });
    return;
  }

  try {
    const db = await connectToDatabase();
    const collection = db.collection('bookmarks');

    // Retrieve all bookmarks and sort by timestamp descending (newest first)
    const bookmarks = await collection
      .find({})
      .sort({ timestamp: -1 })
      .toArray();

    res.status(200).json(bookmarks);
  } catch (err) {
    console.error('Failed to load bookmarks from MongoDB:', err);
    res.status(500).json({ error: 'Failed to retrieve bookmarks from database.', details: err.message });
  }
};
