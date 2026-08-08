const { connectToDatabase } = require("./_lib/db");
const { requireSession } = require("./_lib/auth");

const KNOWN_PLATFORMS = ["instagram", "x", "threads", "reddit", "facebook", "youtube"];

function normalizePlatform(value) {
  const platform = String(value || "").toLowerCase().trim();
  return (platform === "twitter" ? "x" : platform)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function normalizeFolder(value) {
  const folder = String(value || "").trim();
  const lower = folder.toLowerCase();
  if (!folder || lower === "uncategorized" || lower === "others" || lower === "bookmarks bar") return "uncategorized";
  return folder;
}

function emptyPlatformCounts() {
  return Object.fromEntries(KNOWN_PLATFORMS.map(platform => [platform, 0]));
}

async function countCollections(collection, filter = {}) {
  const rows = await collection.aggregate([
    { $match: filter },
    { $project: { key: { $ifNull: ["$folder", ""] } } },
    { $group: { _id: "$key", count: { $sum: 1 } } }
  ]).toArray();

  const counts = { all: 0, uncategorized: 0 };
  rows.forEach(row => {
    const key = normalizeFolder(row._id);
    counts[key] = (counts[key] || 0) + row.count;
    counts.all += row.count;
  });
  return counts;
}

async function countTags(collection, filter = {}) {
  const rows = await collection.aggregate([
    { $match: filter },
    { $unwind: { path: "$hashtags", preserveNullAndEmptyArrays: false } },
    { $group: { _id: "$hashtags", count: { $sum: 1 } } }
  ]).toArray();

  const counts = {};
  rows.forEach(row => {
    const key = String(row._id || "").trim().toLowerCase();
    if (key) counts[key] = (counts[key] || 0) + row.count;
  });
  return counts;
}

module.exports = async (req, res) => {
  if (!requireSession(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  try {
    const collection = (await connectToDatabase()).collection("bookmarks");
    const rows = await collection.aggregate([
      { $match: { source: { $ne: "browser" } } },
      { $group: { _id: "$platform", count: { $sum: 1 }, platformName: { $max: { $ifNull: ["$platformName", ""] } } } }
    ]).toArray();

    const platforms = emptyPlatformCounts();
    const platformLabels = {};
    rows.forEach(row => {
      const platform = normalizePlatform(row._id);
      if (!platform || platform === "browser") return;
      platforms[platform] = (platforms[platform] || 0) + row.count;
      const label = String(row.platformName || "").trim();
      if (label) platformLabels[platform] = label;
    });
    const socialTotal = Object.values(platforms).reduce((total, count) => total + count, 0);
    const socialFilter = { source: { $ne: "browser" } };
    const browserFilter = { source: "browser" };

    const platformCollectionPromises = Object.fromEntries(
      Object.keys(platforms).map(platform => [platform, countCollections(collection, { ...socialFilter, platform })])
    );

    const [browserTotal, socialCollections, browserCollections, socialTags, browserTags] = await Promise.all([
      collection.countDocuments(browserFilter),
      countCollections(collection, socialFilter),
      countCollections(collection, browserFilter),
      countTags(collection, socialFilter),
      countTags(collection, browserFilter)
    ]);

    const platformCollections = {};
    await Promise.all(Object.entries(platformCollectionPromises).map(async ([platform, promise]) => {
      platformCollections[platform] = await promise;
    }));

    return res.status(200).json({
      all: socialTotal,
      ...platforms,
      platforms: { all: socialTotal, ...platforms },
      platformLabels,
      sources: { browser: browserTotal, social: socialTotal },
      collections: { social: socialCollections, browser: browserCollections, platforms: platformCollections },
      tags: { social: socialTags, browser: browserTags }
    });
  } catch (error) {
    console.error("Failed to load bookmark counts:", error);
    return res.status(500).json({ error: "Failed to retrieve bookmark counts." });
  }
};
