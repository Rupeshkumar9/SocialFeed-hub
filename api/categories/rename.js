const { connectToDatabase } = require('../lib/db');
const { requireSession } = require('../lib/auth');

const PROTECTED_NAMES = new Set([
  'all',
  'uncategorized',
  'others',
  'general links',
  'bookmarks bar'
]);

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scopedFilter(source, platform, folder) {
  if (source === 'browser') {
    return {
      $and: [
        { $or: [{ source: 'browser' }, { platform: 'browser' }] },
        { folder }
      ]
    };
  }
  return {
    $and: [
      { source: { $ne: 'browser' } },
      { platform },
      { folder }
    ]
  };
}

module.exports = async (req, res) => {
  if (!requireSession(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const body = req.body || {};
  const source = String(body.source || '').trim().toLowerCase();
  const platform = String(body.platform || '').trim().toLowerCase();
  const oldName = cleanName(body.oldName);
  const newName = cleanName(body.newName);

  if (!['browser', 'social'].includes(source)) {
    return res.status(400).json({ error: 'A valid bookmark source is required.' });
  }
  if (source === 'social' && (!platform || platform === 'all' || platform === 'browser')) {
    return res.status(400).json({ error: 'A concrete social platform is required.' });
  }
  if (!oldName || !newName) return res.status(400).json({ error: 'Both category names are required.' });
  if (oldName.toLowerCase() === newName.toLowerCase()) {
    return res.status(400).json({ error: 'Choose a different category name.' });
  }
  if (PROTECTED_NAMES.has(oldName.toLowerCase()) || PROTECTED_NAMES.has(newName.toLowerCase())) {
    return res.status(400).json({ error: 'That category name is reserved.' });
  }

  try {
    const collection = (await connectToDatabase()).collection('bookmarks');
    const oldFilter = scopedFilter(source, platform, oldName);
    const newFilter = scopedFilter(source, platform, new RegExp(`^${escapeRegex(newName)}$`, 'i'));
    const [oldCount, newCount] = await Promise.all([
      collection.countDocuments(oldFilter),
      collection.countDocuments(newFilter)
    ]);
    if (!oldCount) return res.status(404).json({ error: 'Category not found.' });
    if (newCount) return res.status(409).json({ error: 'A category with that name already exists.' });

    const result = await collection.updateMany(oldFilter, { $set: { folder: newName } });
    return res.status(200).json({ status: 'renamed', matchedCount: result.matchedCount, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Failed to rename category:', error);
    return res.status(500).json({ error: 'Failed to rename category.' });
  }
};
