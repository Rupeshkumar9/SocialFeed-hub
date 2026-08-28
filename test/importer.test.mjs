import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const importerSource = await readFile(
  new URL('../client/src/features/dashboard/features/import/importer.js', import.meta.url),
  'utf8'
);
const importerModule = await import(`data:text/javascript;base64,${Buffer.from(importerSource).toString('base64')}`);
const { BookmarksImporter } = importerModule;

test('imports the JSON package produced by the Threads extension scanner', () => {
  const exported = [{
    id: 'threads_Dch4kv1nHnb',
    platform: 'threads',
    platformItemId: 'Dch4kv1nHnb',
    source: 'social',
    url: 'https://www.threads.com/@freecodecamp/post/Dch4kv1nHnb',
    authorName: 'freeCodeCamp.org',
    authorUsername: 'freecodecamp',
    content: 'System design is how large-scale applications get planned.',
    postUploadedAt: '2026-08-27T04:03:07.000Z',
    extensionScrapedAt: '2026-08-28T16:40:00.000Z',
    hashtags: ['systemdesign'],
    thumbnail: 'data:image/jpeg;base64,example',
    mediaUrls: ['https://example.test/media.jpg'],
    videoUrl: '',
    externalUrls: ['https://www.freecodecamp.org/news/example']
  }];

  const imported = BookmarksImporter.parse('threads_bookmarks_2026-08-28.json', JSON.stringify(exported));

  assert.equal(imported.length, 1);
  assert.equal(imported[0].platform, 'threads');
  assert.equal(imported[0].platformItemId, 'Dch4kv1nHnb');
  assert.equal(imported[0].authorUsername, 'freecodecamp');
  assert.equal(imported[0].thumbnail, exported[0].thumbnail);
  assert.deepEqual(imported[0].mediaUrls, exported[0].mediaUrls);
  assert.deepEqual(imported[0].externalUrls, exported[0].externalUrls);
});

test('trusts a known declared platform when a future Threads hostname is unfamiliar', () => {
  const exported = [{
    platform: 'threads',
    platformItemId: 'Future123',
    url: 'https://future.threads.example/@creator/post/Future123',
    content: 'Future-compatible export'
  }];

  const imported = BookmarksImporter.parse('threads_bookmarks.json', JSON.stringify(exported));
  assert.equal(imported.length, 1);
  assert.equal(imported[0].platform, 'threads');
});

test('restores complete SocialFeed backup metadata', () => {
  const backup = {
    format: 'socialfeed-bookmarks-backup',
    version: 1,
    exportedAt: '2026-08-28T12:00:00.000Z',
    bookmarkCount: 1,
    bookmarks: [{
      id: 'threads_restore123',
      platform: 'threads',
      platformItemId: 'restore123',
      url: 'https://www.threads.com/@creator/post/restore123',
      authorName: 'Creator',
      authorUsername: 'creator',
      content: 'Restorable post',
      firstSavedAt: '2026-01-02T03:04:05.000Z',
      notes: 'Important note',
      folder: 'Research',
      visibility: 'public',
      featured: true,
      publicOrder: 4,
      publicTitle: 'Featured title',
      publicDescription: 'Featured description',
      thumbnail: 'https://example.test/image.jpg'
    }]
  };

  const restored = BookmarksImporter.parse('socialfeed-backup-2026-08-28.json', JSON.stringify(backup));
  assert.equal(restored.length, 1);
  assert.equal(restored[0].firstSavedAt, '2026-01-02T03:04:05.000Z');
  assert.equal(restored[0].notes, 'Important note');
  assert.equal(restored[0].folder, 'Research');
  assert.equal(restored[0].visibility, 'public');
  assert.equal(restored[0].featured, true);
  assert.equal(restored[0].publicOrder, 4);
  assert.equal(restored[0].publicTitle, 'Featured title');
});
