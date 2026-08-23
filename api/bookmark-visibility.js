const { requireSession } = require('./lib/auth');
const { connectToDatabase, ensurePublicProfileIndexes } = require('./lib/db');
const { getPublicCounts } = require('./lib/public-profile');

module.exports = async (req, res) => {
  if (!requireSession(req, res)) return;
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed.' });

  const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.map(id => String(id || '').trim()).filter(Boolean))] : [];
  const visibility = req.body?.visibility === 'public' ? 'public' : req.body?.visibility === 'private' ? 'private' : '';
  if (!ids.length || ids.length > 200) return res.status(400).json({ error: 'Provide between 1 and 200 bookmark IDs.' });
  if (!visibility) return res.status(400).json({ error: 'Visibility must be public or private.' });

  try {
    await ensurePublicProfileIndexes();
    const db = await connectToDatabase();
    const set = {
      visibility,
      visibilityUpdatedAt: new Date().toISOString()
    };
    if (typeof req.body.featured === 'boolean') set.featured = visibility === 'public' && req.body.featured;
    if (req.body.publicTitle !== undefined) set.publicTitle = String(req.body.publicTitle || '').trim().slice(0, 160);
    if (req.body.publicDescription !== undefined) set.publicDescription = String(req.body.publicDescription || '').trim().slice(0, 280);
    if (req.body.publicOrder !== undefined) set.publicOrder = Number.isFinite(Number(req.body.publicOrder)) ? Number(req.body.publicOrder) : null;
    if (req.body.thumbnail !== undefined) {
      const thumbnail = String(req.body.thumbnail || '').trim();
      set.thumbnail = /^https?:\/\//i.test(thumbnail) ? thumbnail.slice(0, 2000) : '';
    }
    const result = await db.collection('bookmarks').updateMany({ userId: req.auth.userId, id: { $in: ids } }, { $set: set });
    const counts = await getPublicCounts(db, req.auth.userId);
    return res.status(200).json({ updated: result.modifiedCount, matched: result.matchedCount, counts });
  } catch (error) {
    console.error('Failed to update bookmark visibility:', error);
    return res.status(500).json({ error: 'Unable to update bookmark visibility.' });
  }
};
