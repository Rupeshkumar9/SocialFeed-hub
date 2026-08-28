const BACKUP_FORMAT = 'socialfeed-bookmarks-backup';
const BACKUP_VERSION = 1;

function toBackupBookmark(bookmark = {}) {
  const { _id, userId, ...portableBookmark } = bookmark;
  return portableBookmark;
}

module.exports = { BACKUP_FORMAT, BACKUP_VERSION, toBackupBookmark };
