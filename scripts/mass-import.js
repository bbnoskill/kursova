// ============================================================
// AudioLib — Масовий імпорт виконавців із MusicBrainz API
// Мета: максимальна кількість артистів з альбомами та треками
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

const USER_AGENT = 'AudioLib/1.0 (andrievskyi@audiolib.ua)';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error(`JSON parse error for ${url}`)); }
      });
    }).on('error', reject);
  });
}

// ============================================================
// Жанрові пошукові запити — максимально широкий спектр
// ============================================================

const SEARCH_QUERIES = [
  // Hip-Hop (пріоритет)
  { tag: 'hip-hop', limit: 100 },
  { tag: 'rap', limit: 100 },
  { tag: 'trap', limit: 50 },
  { tag: 'gangsta rap', limit: 50 },
  // Rock (пріоритет)
  { tag: 'rock', limit: 100 },
  { tag: 'hard rock', limit: 50 },
  { tag: 'classic rock', limit: 50 },
  { tag: 'progressive rock', limit: 50 },
  { tag: 'psychedelic rock', limit: 30 },
  // Metal
  { tag: 'metal', limit: 50 },
  { tag: 'heavy metal', limit: 30 },
  { tag: 'thrash metal', limit: 30 },
  // Alternative / Indie
  { tag: 'alternative', limit: 80 },
  { tag: 'indie rock', limit: 50 },
  { tag: 'indie', limit: 50 },
  { tag: 'grunge', limit: 30 },
  // Pop
  { tag: 'pop', limit: 80 },
  { tag: 'synth-pop', limit: 30 },
  { tag: 'k-pop', limit: 30 },
  // R&B / Soul
  { tag: 'r-n-b', limit: 60 },
  { tag: 'soul', limit: 50 },
  { tag: 'funk', limit: 40 },
  { tag: 'neo-soul', limit: 30 },
  // Electronic
  { tag: 'electronic', limit: 60 },
  { tag: 'house', limit: 30 },
  { tag: 'techno', limit: 30 },
  { tag: 'drum and bass', limit: 30 },
  // Jazz
  { tag: 'jazz', limit: 50 },
  { tag: 'blues', limit: 40 },
  // Reggae / Ska
  { tag: 'reggae', limit: 30 },
  { tag: 'ska', limit: 20 },
  // Punk
  { tag: 'punk', limit: 40 },
  { tag: 'punk rock', limit: 30 },
  { tag: 'post-punk', limit: 30 },
  // Country / Folk
  { tag: 'country', limit: 30 },
  { tag: 'folk', limit: 30 },
  // Latin
  { tag: 'latin', limit: 30 },
  { tag: 'reggaeton', limit: 20 },
  // Classical
  { tag: 'classical', limit: 20 },
  // Grime
  { tag: 'grime', limit: 20 },
];

// Маппінг тегів на жанри в нашій БД
function tagToGenre(tag) {
  const map = {
    'hip-hop': 'Hip-Hop', 'rap': 'Hip-Hop', 'trap': 'Hip-Hop', 'gangsta rap': 'Hip-Hop',
    'rock': 'Rock', 'hard rock': 'Rock', 'classic rock': 'Rock', 'progressive rock': 'Rock',
    'psychedelic rock': 'Rock',
    'metal': 'Metal', 'heavy metal': 'Metal', 'thrash metal': 'Metal',
    'alternative': 'Alternative', 'indie rock': 'Indie', 'indie': 'Indie', 'grunge': 'Alternative',
    'pop': 'Pop', 'synth-pop': 'Pop', 'k-pop': 'Pop',
    'r-n-b': 'R&B', 'soul': 'Soul', 'funk': 'Funk', 'neo-soul': 'Soul',
    'electronic': 'Electronic', 'house': 'Electronic', 'techno': 'Electronic', 'drum and bass': 'Electronic',
    'jazz': 'Jazz', 'blues': 'Blues',
    'reggae': 'Reggae', 'ska': 'Reggae',
    'punk': 'Punk', 'punk rock': 'Punk', 'post-punk': 'Punk',
    'country': 'Country', 'folk': 'Folk',
    'latin': 'Latin', 'reggaeton': 'Latin',
    'classical': 'Classical',
    'grime': 'Hip-Hop',
  };
  return map[tag] || 'Rock';
}

function tagToStyle(tag) {
  const map = {
    'hip-hop': 'Hip-Hop', 'rap': 'Hip-Hop', 'trap': 'Trap', 'gangsta rap': 'Gangsta Rap',
    'rock': 'Rock', 'hard rock': 'Hard Rock', 'classic rock': 'Classic Rock',
    'progressive rock': 'Progressive Rock', 'psychedelic rock': 'Psychedelic Rock',
    'metal': 'Metal', 'heavy metal': 'Heavy Metal', 'thrash metal': 'Thrash Metal',
    'alternative': 'Alternative', 'indie rock': 'Indie Rock', 'indie': 'Indie', 'grunge': 'Grunge',
    'pop': 'Pop', 'synth-pop': 'Synth-Pop', 'k-pop': 'K-Pop',
    'r-n-b': 'R&B', 'soul': 'Soul', 'funk': 'Funk', 'neo-soul': 'Neo-Soul',
    'electronic': 'Electronic', 'house': 'House', 'techno': 'Techno', 'drum and bass': 'Drum & Bass',
    'jazz': 'Jazz', 'blues': 'Blues',
    'reggae': 'Reggae', 'ska': 'Ska',
    'punk': 'Punk', 'punk rock': 'Punk Rock', 'post-punk': 'Post-Punk',
    'country': 'Country', 'folk': 'Folk',
    'latin': 'Latin', 'reggaeton': 'Reggaeton',
    'classical': 'Classical',
    'grime': 'Grime',
  };
  return map[tag] || tag;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  AudioLib — МАСОВИЙ імпорт           ║');
  console.log('║  MusicBrainz API (максимум даних)    ║');
  console.log('╚══════════════════════════════════════╝\n');

  const client = await pool.connect();

  // Жанри
  const genreMap = new Map();
  const genreRows = await client.query('SELECT id, name FROM genres');
  genreRows.rows.forEach(g => genreMap.set(g.name, g.id));

  // Вже існуючі артисти (уникаємо дублів)
  const existingNames = new Set();
  const existingArtists = await client.query('SELECT name FROM artists');
  existingArtists.rows.forEach(a => existingNames.add(a.name.toLowerCase()));

  // Вимкнути аудит
  await client.query('ALTER TABLE artists DISABLE TRIGGER trg_audit_artists');
  await client.query('ALTER TABLE albums DISABLE TRIGGER trg_audit_albums');
  await client.query('ALTER TABLE records DISABLE TRIGGER trg_audit_records');

  const artistMbids = new Map(); // mbid -> { dbId, name, style, genreName }
  let totalArtists = 0;
  let totalAlbums = 0;
  let totalRecords = 0;

  // ════════════════════════════════════════════════════════
  // Фаза 1: Збір виконавців
  // ════════════════════════════════════════════════════════

  console.log('═══ Фаза 1: Збір виконавців ═══\n');

  for (const q of SEARCH_QUERIES) {
    let offset = 0;
    const style = tagToStyle(q.tag);
    const genreName = tagToGenre(q.tag);

    while (offset < q.limit) {
      const fetchCount = Math.min(100, q.limit - offset);
      const url = `https://musicbrainz.org/ws/2/artist?query=tag:${encodeURIComponent(q.tag)}&fmt=json&limit=${fetchCount}&offset=${offset}`;

      try {
        const data = await httpGet(url);
        await sleep(1100);

        if (!data.artists || data.artists.length === 0) break;

        for (const a of data.artists) {
          if (!a.name || a.name.length > 100) continue;
          if (existingNames.has(a.name.toLowerCase())) continue;
          if (artistMbids.has(a.id)) continue;

          const country = a.country || a.area?.name || 'Unknown';

          try {
            const res = await client.query(
              `INSERT INTO artists (name, country, style) VALUES ($1, $2, $3)
               ON CONFLICT DO NOTHING RETURNING id`,
              [a.name, country, style]
            );
            if (res.rows.length > 0) {
              artistMbids.set(a.id, { dbId: res.rows[0].id, name: a.name, style, genreName });
              existingNames.add(a.name.toLowerCase());
              totalArtists++;
            }
          } catch (e) { /* duplicate */ }
        }

        offset += fetchCount;
      } catch (e) {
        console.log(`  ⚠ Помилка запиту ${q.tag}: ${e.message}`);
        await sleep(2000);
        break;
      }
    }

    console.log(`  [${q.tag}] → ${totalArtists} артистів загалом`);
  }

  console.log(`\n  ► Фаза 1 завершена: ${totalArtists} нових виконавців\n`);

  // ════════════════════════════════════════════════════════
  // Фаза 2: Альбоми та треки для кожного артиста
  // ════════════════════════════════════════════════════════

  console.log('═══ Фаза 2: Альбоми та треки ═══\n');

  const entries = Array.from(artistMbids.entries());
  let processed = 0;

  for (const [mbid, artist] of entries) {
    processed++;

    // Прогрес кожні 20 артистів
    if (processed % 20 === 0) {
      console.log(`  → Оброблено ${processed}/${entries.length} | Альбомів: ${totalAlbums} | Записів: ${totalRecords}`);
    }

    try {
      // Отримуємо до 3 альбомів (release-groups)
      const rgUrl = `https://musicbrainz.org/ws/2/release-group?artist=${mbid}&type=album&fmt=json&limit=3`;
      const rgData = await httpGet(rgUrl);
      await sleep(1100);

      if (!rgData['release-groups'] || rgData['release-groups'].length === 0) continue;

      for (const rg of rgData['release-groups'].slice(0, 3)) {
        if (!rg.title) continue;
        const releaseYear = rg['first-release-date']
          ? parseInt(rg['first-release-date'].substring(0, 4))
          : null;

        // Вставити альбом
        let albumId;
        try {
          const albumRes = await client.query(
            `INSERT INTO albums (title, release_year, artist_id) VALUES ($1, $2, $3) RETURNING id`,
            [rg.title, releaseYear, artist.dbId]
          );
          albumId = albumRes.rows[0].id;
          totalAlbums++;

          // Жанр альбому
          const genreId = genreMap.get(artist.genreName);
          if (genreId) {
            await client.query(
              'INSERT INTO album_genres (album_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [albumId, genreId]
            );
          }
        } catch (e) { continue; }

        // Знаходимо реліз і треклист
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

              const lengthSec = track.recording.length
                ? Math.round(track.recording.length / 1000)
                : Math.floor(Math.random() * 240) + 120;

              try {
                const recRes = await client.query(
                  `INSERT INTO records (title, length, type, release_year, artist_id, album_id)
                   VALUES ($1, $2, 'song', $3, $4, $5) RETURNING id`,
                  [track.recording.title, lengthSec, releaseYear, artist.dbId, albumId]
                );
                totalRecords++;

                // Жанр запису (основний)
                const genreId = genreMap.get(artist.genreName);
                if (genreId) {
                  await client.query(
                    'INSERT INTO record_genres (record_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [recRes.rows[0].id, genreId]
                  );
                }
                // Іноді другий жанр
                if (Math.random() > 0.65) {
                  const allGenreIds = Array.from(genreMap.values());
                  const second = allGenreIds[Math.floor(Math.random() * allGenreIds.length)];
                  if (second !== genreId) {
                    await client.query(
                      'INSERT INTO record_genres (record_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                      [recRes.rows[0].id, second]
                    );
                  }
                }
              } catch (e) { /* skip */ }
            }
          }
        } catch (e) { /* skip album tracks */ }
      }
    } catch (e) {
      // skip artist completely
    }
  }

  // ════════════════════════════════════════════════════════
  // Фаза 3: Генерація прослуховувань для нових записів
  // ════════════════════════════════════════════════════════

  console.log('\n═══ Фаза 3: Прослуховування для нових записів ═══');

  const allRecordIds = (await client.query('SELECT id FROM records')).rows.map(r => r.id);
  const allUserIds = (await client.query('SELECT id FROM users')).rows.map(r => r.id);

  if (allRecordIds.length > 0 && allUserIds.length > 0) {
    // Генеруємо пропорційно нових прослуховувань
    const newListenings = Math.min(totalRecords * 3, 8000);
    console.log(`  → Генерація ${newListenings} прослуховувань...`);

    await client.query('ALTER TABLE listenings DISABLE TRIGGER trg_check_subscription_access');

    const batchSize = 500;
    let values = [];
    let params = [];
    let pIdx = 1;
    let insertedListenings = 0;

    for (let i = 0; i < newListenings; i++) {
      const uid = allUserIds[Math.floor(Math.random() * allUserIds.length)];
      const rid = allRecordIds[Math.floor(Math.random() * allRecordIds.length)];
      const daysAgo = Math.floor(Math.random() * 365);
      const hoursAgo = Math.floor(Math.random() * 24);
      const durSec = Math.floor(Math.random() * 300) + 30;

      values.push(`($${pIdx++}, $${pIdx++}, NOW() - INTERVAL '${daysAgo} days ${hoursAgo} hours', $${pIdx++})`);
      params.push(uid, rid, durSec);

      if (values.length >= batchSize || i === newListenings - 1) {
        try {
          await client.query(
            `INSERT INTO listenings (user_id, record_id, listened_at, duration_sec) VALUES ${values.join(', ')}`,
            params
          );
          insertedListenings += values.length;
        } catch (e) {
          console.log(`  ⚠ Batch error: ${e.message}`);
        }
        values = [];
        params = [];
        pIdx = 1;
      }
    }

    await client.query('ALTER TABLE listenings ENABLE TRIGGER trg_check_subscription_access');
    console.log(`  ✓ Додано прослуховувань: ${insertedListenings}`);
  }

  // ════════════════════════════════════════════════════════
  // Фіналізація
  // ════════════════════════════════════════════════════════

  // Видалити артистів без записів (якщо MusicBrainz не мав для них даних)
  const cleaned = await client.query(`
    DELETE FROM artists WHERE id NOT IN (SELECT DISTINCT artist_id FROM records)
      AND id NOT IN (SELECT DISTINCT artist_id FROM albums)
  `);

  // Ввімкнути тригери
  await client.query('ALTER TABLE artists ENABLE TRIGGER trg_audit_artists');
  await client.query('ALTER TABLE albums ENABLE TRIGGER trg_audit_albums');
  await client.query('ALTER TABLE records ENABLE TRIGGER trg_audit_records');

  // Підсумок
  const stats = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM artists) AS artists,
      (SELECT COUNT(*) FROM albums) AS albums,
      (SELECT COUNT(*) FROM records) AS records,
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM playlists) AS playlists,
      (SELECT COUNT(*) FROM listenings) AS listenings,
      (SELECT COUNT(DISTINCT style) FROM artists) AS styles
  `);
  const s = stats.rows[0];

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║       МАСОВИЙ ІМПОРТ ЗАВЕРШЕНО       ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Нових артистів:   ${String(totalArtists).padStart(5)}             ║`);
  console.log(`║  Нових альбомів:   ${String(totalAlbums).padStart(5)}             ║`);
  console.log(`║  Нових записів:    ${String(totalRecords).padStart(5)}             ║`);
  console.log(`║  Видалено порожніх: ${String(cleaned.rowCount).padStart(4)}             ║`);
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  ВСЬОГО артистів:  ${String(s.artists).padStart(5)}             ║`);
  console.log(`║  ВСЬОГО альбомів:  ${String(s.albums).padStart(5)}             ║`);
  console.log(`║  ВСЬОГО записів:   ${String(s.records).padStart(5)}             ║`);
  console.log(`║  Стилів:           ${String(s.styles).padStart(5)}             ║`);
  console.log(`║  Користувачів:     ${String(s.users).padStart(5)}             ║`);
  console.log(`║  Плейлистів:       ${String(s.playlists).padStart(5)}             ║`);
  console.log(`║  Прослуховувань:   ${String(s.listenings).padStart(5)}             ║`);
  console.log('╚══════════════════════════════════════╝');

  client.release();
  await pool.end();
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
