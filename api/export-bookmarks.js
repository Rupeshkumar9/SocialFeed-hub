const { requireSession } = require('./lib/auth');
const { BACKUP_FORMAT, BACKUP_VERSION, toBackupBookmark } = require('./lib/bookmark-backup');
const { connectToDatabase } = require('./lib/db');
const { once } = require('events');

function backupFileName(date = new Date()) {
  return `socialfeed-backup-${date.toISOString().slice(0, 10)}.json`;
}

module.exports = async (req, res) => {
  if (!requireSession(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed. Use GET.' });

  try {
    const collection = (await connectToDatabase()).collection('bookmarks');
    const cursor = collection
      .find({ userId: req.auth.userId })
      .sort({ firstSavedAt: -1, _id: -1 });
    const exportedAt = new Date();
    let count = 0;
    let first = true;
    const writeChunk = async chunk => {
      if (res.destroyed) throw new Error('Backup download connection closed.');
      if (!res.write(chunk)) await once(res, 'drain');
    };

    res.status(200);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${backupFileName(exportedAt)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    await writeChunk(`{"format":${JSON.stringify(BACKUP_FORMAT)},"version":${BACKUP_VERSION},"exportedAt":${JSON.stringify(exportedAt.toISOString())},"bookmarks":[`);

    for await (const bookmark of cursor) {
      if (!first) await writeChunk(',');
      await writeChunk(JSON.stringify(toBackupBookmark(bookmark)));
      first = false;
      count++;
    }

    res.end(`],"bookmarkCount":${count}}`);
  } catch (error) {
    console.error('Unable to export bookmark backup:', error);
    if (!res.headersSent) return res.status(500).json({ error: 'Unable to export bookmark backup.' });
    return res.destroy(error);
  }
};

module.exports.backupFileName = backupFileName;
