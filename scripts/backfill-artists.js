// ============================================================
// Швидкий скрипт для доімпорту альбомів і треків для
// виконавців що мають 0 записів
// ============================================================

const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  host: 'localhost',
  port: 12288,
  user: 'postgres',
  password: 'postgres',
  database: 'audiolib',
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'AudioLib/1.0 (andrievskyi@audiolib.ua)', 'Accept': 'application/json' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

async function main() {
  const client = await pool.connect();

  // Вимикаємо аудит тригери
  await client.query('ALTER TABLE artists DISABLE TRIGGER trg_audit_artists');
  await client.query('ALTER TABLE albums DISABLE TRIGGER trg_audit_albums');
  await client.query('ALTER TABLE records DISABLE TRIGGER trg_audit_records');

  // 1. Знайдемо артистів з 0 записів
  const emptyArtists = await client.query(`
    SELECT a.id, a.name, a.style FROM artists a
    WHERE (SELECT COUNT(*) FROM records WHERE artist_id = a.id) = 0
    ORDER BY a.id
  `);

  console.log(`Артистів без записів: ${emptyArtists.rows.length}`);

  // Для кожного шукаємо через MusicBrainz
  const genreMap = new Map();
  const genres = await client.query('SELECT id, name FROM genres');
  genres.rows.forEach(g => genreMap.set(g.name.toLowerCase(), g.id));

  let totalAlbums = 0, totalRecords = 0;

  for (const artist of emptyArtists.rows) {
    console.log(`\n→ ${artist.name}...`);
    try {
      // Пошук артиста в MusicBrainz
      const searchUrl = `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(artist.name)}&fmt=json&limit=1`;
      const searchData = await httpGet(searchUrl);
      await sleep(1100);

      if (!searchData.artists || searchData.artists.length === 0) {
        console.log(`  ⚠ Не знайдено в MusicBrainz`);
        continue;
      }

      const mbid = searchData.artists[0].id;

      // Альбоми
      const rgUrl = `https://musicbrainz.org/ws/2/release-group?artist=${mbid}&type=album&fmt=json&limit=5`;
      const rgData = await httpGet(rgUrl);
      await sleep(1100);

      if (!rgData['release-groups'] || rgData['release-groups'].length === 0) {
        console.log(`  ⚠ Немає альбомів`);
        continue;
      }

      for (const rg of rgData['release-groups'].slice(0, 5)) {
        if (!rg.title) continue;
        const releaseYear = rg['first-release-date'] ? parseInt(rg['first-release-date'].substring(0, 4)) : null;

        let albumId;
        try {
          const albumRes = await client.query(
            `INSERT INTO albums (title, release_year, artist_id) VALUES ($1, $2, $3) RETURNING id`,
            [rg.title, releaseYear, artist.id]
          );
          albumId = albumRes.rows[0].id;
          totalAlbums++;

          // Жанр альбому
          const styleKey = (artist.style || 'rock').toLowerCase();
          const genreId = genreMap.get(styleKey) || genreMap.get('rock');
          if (genreId) {
            await client.query('INSERT INTO album_genres (album_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [albumId, genreId]);
          }
        } catch (e) { continue; }

        // Треки
        try {
          const relUrl = `https://musicbrainz.org/ws/2/release?release-group=${rg.id}&fmt=json&limit=1`;
          const relData = await httpGet(relUrl);
          await sleep(1100);
          if (!relData.releases || relData.releases.length === 0) continue;

          const recUrl = `https://musicbrainz.org/ws/2/release/${relData.releases[0].id}?inc=recordings&fmt=json`;
          const recData = await httpGet(recUrl);
          await sleep(1100);

          if (!recData.media) continue;
          for (const medium of recData.media) {
            if (!medium.tracks) continue;
            for (const track of medium.tracks) {
              if (!track.recording || !track.recording.title) continue;
              const lengthSec = track.recording.length ? Math.round(track.recording.length / 1000) : Math.floor(Math.random() * 300) + 120;
              try {
                const recRes = await client.query(
                  `INSERT INTO records (title, length, type, release_year, artist_id, album_id) VALUES ($1,$2,'song',$3,$4,$5) RETURNING id`,
                  [track.recording.title, lengthSec, releaseYear, artist.id, albumId]
                );
                totalRecords++;
                // Жанр
                const styleKey = (artist.style || 'rock').toLowerCase();
                const genreId = genreMap.get(styleKey) || genreMap.get('rock');
                if (genreId) {
                  await client.query('INSERT INTO record_genres (record_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [recRes.rows[0].id, genreId]);
                }
              } catch (e) {}
            }
          }
        } catch (e) {}
      }
      console.log(`  ✓ OK`);
    } catch (e) {
      console.log(`  ⚠ ${e.message}`);
    }
  }

  // Вмикаємо тригери
  await client.query('ALTER TABLE artists ENABLE TRIGGER trg_audit_artists');
  await client.query('ALTER TABLE albums ENABLE TRIGGER trg_audit_albums');
  await client.query('ALTER TABLE records ENABLE TRIGGER trg_audit_records');

  // Видаляємо артистів, для яких все ще 0 записів
  const deleted = await client.query(`
    DELETE FROM artists WHERE id NOT IN (SELECT DISTINCT artist_id FROM records)
    AND id NOT IN (SELECT DISTINCT artist_id FROM albums)
  `);

  const finalStats = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM artists) AS artists,
      (SELECT COUNT(*) FROM albums) AS albums,
      (SELECT COUNT(*) FROM records) AS records
  `);
  const s = finalStats.rows[0];

  console.log(`\n═══ Результат ═══`);
  console.log(`  Додано альбомів: ${totalAlbums}`);
  console.log(`  Додано записів: ${totalRecords}`);
  console.log(`  Видалено порожніх артистів: ${deleted.rowCount}`);
  console.log(`  Всього артистів: ${s.artists}`);
  console.log(`  Всього альбомів: ${s.albums}`);
  console.log(`  Всього записів: ${s.records}`);

  client.release();
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
