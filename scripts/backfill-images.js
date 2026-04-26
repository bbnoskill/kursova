// ============================================================
// AudioLib — Backfill зображень з MusicBrainz / Cover Art Archive
// ============================================================

const { Pool } = require('pg');
const https = require('https');
const http = require('http');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 12288,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'audiolib',
});

const USER_AGENT = 'AudioLib/1.0 (andrievskyi@audiolib.ua)';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      timeout: 10000,
    }, res => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpGet(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode === 404) { resolve(null); return; }
      if (res.statusCode !== 200) { resolve(null); return; }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// Check if an image URL is accessible (returns true/false)
function checkImageUrl(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method: 'HEAD', headers: { 'User-Agent': USER_AGENT }, timeout: 5000 }, res => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(res.headers.location); // Return the final URL
        return;
      }
      resolve(res.statusCode === 200 ? url : null);
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ============================================================
// Phase 1: Artists — find MBIDs
// ============================================================

async function backfillArtistMbids(client) {
  console.log('\n═══ Фаза 1: Пошук MBIDs для виконавців ═══');

  const artists = await client.query(`
    SELECT id, name FROM artists WHERE mbid IS NULL ORDER BY id
  `);

  console.log(`  Виконавців без MBID: ${artists.rows.length}`);
  let found = 0;

  for (const a of artists.rows) {
    try {
      const url = `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(a.name)}&fmt=json&limit=1`;
      const data = await httpGet(url);
      await sleep(1100);

      if (data && data.artists && data.artists.length > 0) {
        const match = data.artists[0];
        // Check name similarity
        if (match.name.toLowerCase() === a.name.toLowerCase() || match.score >= 90) {
          await client.query('UPDATE artists SET mbid = $1 WHERE id = $2', [match.id, a.id]);
          found++;
        }
      }
    } catch (e) {
      // skip
    }

    if (found % 20 === 0 && found > 0) {
      console.log(`  → Знайдено MBID: ${found}/${artists.rows.length}`);
    }
  }

  console.log(`  ► Знайдено MBID: ${found} з ${artists.rows.length}`);
}

// ============================================================
// Phase 2: Artist images from MusicBrainz relations
// ============================================================

async function backfillArtistImages(client) {
  console.log('\n═══ Фаза 2: Зображення виконавців ═══');

  const artists = await client.query(`
    SELECT id, name, mbid FROM artists WHERE mbid IS NOT NULL AND image_url IS NULL ORDER BY id
  `);

  console.log(`  Виконавців для обробки: ${artists.rows.length}`);
  let found = 0;

  for (const a of artists.rows) {
    try {
      // Get artist with URL-rels (contains links to Wikipedia, Wikidata etc.)
      const url = `https://musicbrainz.org/ws/2/artist/${a.mbid}?inc=url-rels&fmt=json`;
      const data = await httpGet(url);
      await sleep(1100);

      if (!data || !data.relations) continue;

      // Look for image relationship or Wikidata
      let imageUrl = null;

      // Check for direct image relation
      for (const rel of data.relations) {
        if (rel.type === 'image' && rel.url && rel.url.resource) {
          // Wikimedia Commons URL — convert to actual image
          const resource = rel.url.resource;
          if (resource.includes('commons.wikimedia.org')) {
            // Extract filename from commons URL
            const match = resource.match(/File:(.+)$/);
            if (match) {
              const filename = decodeURIComponent(match[1]).replace(/ /g, '_');
              imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=300`;
            }
          } else {
            imageUrl = resource;
          }
          break;
        }
      }

      // Fallback: try Wikidata for image
      if (!imageUrl) {
        for (const rel of data.relations) {
          if (rel.type === 'wikidata' && rel.url && rel.url.resource) {
            const wdId = rel.url.resource.match(/Q\d+/);
            if (wdId) {
              try {
                const wdUrl = `https://www.wikidata.org/wiki/Special:EntityData/${wdId[0]}.json`;
                const wdData = await httpGet(wdUrl);
                await sleep(500);

                if (wdData && wdData.entities && wdData.entities[wdId[0]]) {
                  const entity = wdData.entities[wdId[0]];
                  // P18 = image property in Wikidata
                  const imageClaim = entity.claims?.P18;
                  if (imageClaim && imageClaim[0]?.mainsnak?.datavalue?.value) {
                    const filename = imageClaim[0].mainsnak.datavalue.value.replace(/ /g, '_');
                    imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=300`;
                  }
                }
              } catch (e) { /* skip */ }
            }
            break;
          }
        }
      }

      if (imageUrl) {
        await client.query('UPDATE artists SET image_url = $1 WHERE id = $2', [imageUrl, a.id]);
        found++;
      }
    } catch (e) {
      // skip
    }

    if ((found % 10 === 0 && found > 0) || artists.rows.indexOf(a) % 50 === 0) {
      console.log(`  → Зображень: ${found} | Оброблено: ${artists.rows.indexOf(a) + 1}/${artists.rows.length}`);
    }
  }

  console.log(`  ► Знайдено зображень артистів: ${found}`);
}

// ============================================================
// Phase 3: Album MBIDs
// ============================================================

async function backfillAlbumMbids(client) {
  console.log('\n═══ Фаза 3: Пошук MBIDs для альбомів ═══');

  // Get albums with their artist MBIDs
  const albums = await client.query(`
    SELECT al.id, al.title, al.artist_id, a.name AS artist_name, a.mbid AS artist_mbid
    FROM albums al
    JOIN artists a ON al.artist_id = a.id
    WHERE al.mbid IS NULL AND a.mbid IS NOT NULL
    ORDER BY al.id
  `);

  console.log(`  Альбомів для обробки: ${albums.rows.length}`);
  let found = 0;

  // Group albums by artist to minimize API calls
  const byArtist = new Map();
  for (const al of albums.rows) {
    if (!byArtist.has(al.artist_mbid)) byArtist.set(al.artist_mbid, []);
    byArtist.get(al.artist_mbid).push(al);
  }

  for (const [artistMbid, artistAlbums] of byArtist) {
    try {
      const url = `https://musicbrainz.org/ws/2/release-group?artist=${artistMbid}&type=album&fmt=json&limit=100`;
      const data = await httpGet(url);
      await sleep(1100);

      if (!data || !data['release-groups']) continue;

      for (const rg of data['release-groups']) {
        // Match by title
        const match = artistAlbums.find(al =>
          al.title.toLowerCase() === rg.title.toLowerCase()
        );
        if (match) {
          await client.query('UPDATE albums SET mbid = $1 WHERE id = $2', [rg.id, match.id]);
          found++;
        }
      }
    } catch (e) {
      // skip
    }
  }

  console.log(`  ► Знайдено MBID альбомів: ${found} з ${albums.rows.length}`);
}

// ============================================================
// Phase 4: Album cover art from Cover Art Archive
// ============================================================

async function backfillAlbumCovers(client) {
  console.log('\n═══ Фаза 4: Обкладинки альбомів ═══');

  const albums = await client.query(`
    SELECT id, title, mbid FROM albums WHERE mbid IS NOT NULL AND image_url IS NULL ORDER BY id
  `);

  console.log(`  Альбомів для обробки: ${albums.rows.length}`);
  let found = 0;

  for (const al of albums.rows) {
    try {
      // Cover Art Archive uses release-group MBID
      const coverUrl = `https://coverartarchive.org/release-group/${al.mbid}/front-250`;
      const finalUrl = await checkImageUrl(coverUrl);
      await sleep(300); // CAA has more relaxed rate limits

      if (finalUrl) {
        await client.query('UPDATE albums SET image_url = $1 WHERE id = $2', [finalUrl, al.id]);
        found++;
      }
    } catch (e) {
      // skip
    }

    if (found % 20 === 0 && found > 0) {
      console.log(`  → Обкладинок: ${found} | Оброблено: ${albums.rows.indexOf(al) + 1}/${albums.rows.length}`);
    }
  }

  console.log(`  ► Знайдено обкладинок: ${found}`);
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  AudioLib — Backfill зображень       ║');
  console.log('╚══════════════════════════════════════╝');

  const client = await pool.connect();

  try {
    await backfillArtistMbids(client);
    await backfillArtistImages(client);
    await backfillAlbumMbids(client);
    await backfillAlbumCovers(client);

    // Stats
    const stats = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM artists WHERE image_url IS NOT NULL) AS artist_images,
        (SELECT COUNT(*) FROM artists) AS total_artists,
        (SELECT COUNT(*) FROM albums WHERE image_url IS NOT NULL) AS album_images,
        (SELECT COUNT(*) FROM albums) AS total_albums
    `);
    const s = stats.rows[0];

    console.log('\n╔══════════════════════════════════════╗');
    console.log('║       Backfill завершено             ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║  Зображення артистів: ${s.artist_images}/${s.total_artists}`.padEnd(39) + '║');
    console.log(`║  Обкладинки альбомів: ${s.album_images}/${s.total_albums}`.padEnd(39) + '║');
    console.log('╚══════════════════════════════════════╝');
  } catch (err) {
    console.error('Помилка:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
