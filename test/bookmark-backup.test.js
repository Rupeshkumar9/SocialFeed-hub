const assert = require('node:assert/strict');
const test = require('node:test');

const { ObjectId } = require('mongodb');
const { BACKUP_FORMAT, BACKUP_VERSION, toBackupBookmark } = require('../api/lib/bookmark-backup');
const { backupFileName } = require('../api/export-bookmarks');

test('backup format is versioned and removes database ownership fields', () => {
  const portable = toBackupBookmark({
    _id: new ObjectId(),
    userId: 'private-user-id',
    id: 'threads_123',
    platform: 'threads',
    notes: 'Keep this',
    visibility: 'public'
  });

  assert.equal(BACKUP_FORMAT, 'socialfeed-bookmarks-backup');
  assert.equal(BACKUP_VERSION, 1);
  assert.equal(portable._id, undefined);
  assert.equal(portable.userId, undefined);
  assert.equal(portable.id, 'threads_123');
  assert.equal(portable.notes, 'Keep this');
  assert.equal(portable.visibility, 'public');
});

test('backup filename uses a stable ISO date', () => {
  assert.equal(backupFileName(new Date('2026-08-28T10:15:00.000Z')), 'socialfeed-backup-2026-08-28.json');
});
