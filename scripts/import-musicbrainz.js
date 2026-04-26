// ============================================================
// AudioLib — Імпорт даних із MusicBrainz API
// https://musicbrainz.org/ws/2
// ============================================================

const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 12288,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'audiolib',
});

const USER_AGENT = 'AudioLib/1.0 (andrievskyi@audiolib.ua)';

// Rate limiter: 1 запит/сек (вимога MusicBrainz API)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

// ============================================================
// Імпорт виконавців
// ============================================================

async function importArtists(client) {
  console.log('\n═══ Імпорт виконавців ═══');

  // Пошук виконавців різних жанрів (hip-hop та rock в пріоритеті)
  const queries = [
    { tag: 'hip-hop', limit: 60 },
    { tag: 'rock', limit: 60 },
    { tag: 'pop', limit: 30 },
    { tag: 'r-n-b', limit: 20 },
    { tag: 'electronic', limit: 15 },
    { tag: 'jazz', limit: 15 },
    { tag: 'indie', limit: 10 },
    { tag: 'punk', limit: 10 },
  ];

  const artistMap = new Map(); // mbid -> { name, country, style, dbId }
  let totalInserted = 0;

  for (const q of queries) {
    let offset = 0;
    const batchSize = 100;

    while (totalInserted < 220 && offset < q.limit) {
      const fetchCount = Math.min(batchSize, q.limit - offset);
      const url = `https://musicbrainz.org/ws/2/artist?query=tag:${q.tag}&fmt=json&limit=${fetchCount}&offset=${offset}`;
      console.log(`  → Запит: tag=${q.tag}, offset=${offset}, limit=${fetchCount}`);

      try {
        const data = await httpGet(url);
        await sleep(1100);

        if (!data.artists || data.artists.length === 0) break;

        for (const a of data.artists) {
          if (artistMap.has(a.id)) continue;
          if (!a.name) continue;

          const country = a.country || a.area?.name || 'Unknown';
          const style = q.tag.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            .replace('R N B', 'R&B').replace('Hip Hop', 'Hip-Hop');

          try {
            const result = await client.query(
              `INSERT INTO artists (name, country, style) VALUES ($1, $2, $3)
               ON CONFLICT DO NOTHING RETURNING id`,
              [a.name, country, style]
            );
            if (result.rows.length > 0) {
              artistMap.set(a.id, { name: a.name, dbId: result.rows[0].id, style });
              totalInserted++;
            }
          } catch (err) {
            // skip duplicates
          }
        }

        offset += fetchCount;
      } catch (err) {
        console.log(`  ⚠ Помилка запиту: ${err.message}`);
        await sleep(2000);
        break;
      }
    }
    console.log(`  ✓ ${q.tag}: знайдено ${totalInserted} виконавців загалом`);
    if (totalInserted >= 220) break;
  }

  console.log(`\n  ► Всього імпортовано виконавців: ${totalInserted}`);
  return artistMap;
}

// ============================================================
// Імпорт альбомів та записів
// ============================================================

async function importAlbumsAndRecords(client, artistMap) {
  console.log('\n═══ Імпорт альбомів та записів ═══');

  const genreMap = new Map();
  const genres = await client.query('SELECT id, name FROM genres');
  genres.rows.forEach(g => genreMap.set(g.name.toLowerCase(), g.id));

  let albumCount = 0;
  let recordCount = 0;
  const artistEntries = Array.from(artistMap.entries());

  // Перемішуємо для різноманітності
  for (let i = artistEntries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [artistEntries[i], artistEntries[j]] = [artistEntries[j], artistEntries[i]];
  }

  for (const [mbid, artist] of artistEntries) {
    if (recordCount >= 1200) break;

    try {
      // Отримуємо альбоми (release-groups) виконавця
      const rgUrl = `https://musicbrainz.org/ws/2/release-group?artist=${mbid}&type=album&fmt=json&limit=10`;
      const rgData = await httpGet(rgUrl);
      await sleep(1100);

      if (!rgData['release-groups'] || rgData['release-groups'].length === 0) continue;

      for (const rg of rgData['release-groups']) {
        if (albumCount >= 350 && recordCount >= 1200) break;
        if (!rg.title) continue;

        const releaseYear = rg['first-release-date']
          ? parseInt(rg['first-release-date'].substring(0, 4))
          : null;

        // Вставляємо альбом
        let albumId;
        try {
          const albumResult = await client.query(
            `INSERT INTO albums (title, release_year, artist_id) VALUES ($1, $2, $3) RETURNING id`,
            [rg.title, releaseYear, artist.dbId]
          );
          albumId = albumResult.rows[0].id;
          albumCount++;

          // Прив'язуємо жанр альбому
          const styleKey = artist.style.toLowerCase().replace('&', '&');
          const genreId = genreMap.get(styleKey) || genreMap.get('rock');
          if (genreId) {
            await client.query(
              'INSERT INTO album_genres (album_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [albumId, genreId]
            );
          }
        } catch (err) {
          continue;
        }

        // Отримуємо записи (recordings) з першого релізу альбому
        try {
          // Знаходимо реліз цієї release-group
          const relUrl = `https://musicbrainz.org/ws/2/release?release-group=${rg.id}&fmt=json&limit=1`;
          const relData = await httpGet(relUrl);
          await sleep(1100);

          if (!relData.releases || relData.releases.length === 0) continue;

          const releaseId = relData.releases[0].id;

          // Отримуємо треклист
          const recUrl = `https://musicbrainz.org/ws/2/release/${releaseId}?inc=recordings&fmt=json`;
          const recData = await httpGet(recUrl);
          await sleep(1100);

          if (!recData.media) continue;

          for (const medium of recData.media) {
            if (!medium.tracks) continue;
            for (const track of medium.tracks) {
              if (recordCount >= 1200) break;
              if (!track.recording || !track.recording.title) continue;

              const lengthSec = track.recording.length
                ? Math.round(track.recording.length / 1000)
                : Math.floor(Math.random() * 300) + 120;

              try {
                const recResult = await client.query(
                  `INSERT INTO records (title, length, type, release_year, artist_id, album_id)
                   VALUES ($1, $2, 'song', $3, $4, $5) RETURNING id`,
                  [track.recording.title, lengthSec, releaseYear, artist.dbId, albumId]
                );
                recordCount++;

                // Прив'язуємо жанр запису
                const styleKey = artist.style.toLowerCase().replace('&', '&');
                const genreId = genreMap.get(styleKey) || genreMap.get('rock');
                if (genreId) {
                  await client.query(
                    'INSERT INTO record_genres (record_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [recResult.rows[0].id, genreId]
                  );
                }
                // Іноді додаємо другий жанр
                if (Math.random() > 0.6) {
                  const allGenres = Array.from(genreMap.values());
                  const secondGenre = allGenres[Math.floor(Math.random() * allGenres.length)];
                  if (secondGenre !== genreId) {
                    await client.query(
                      'INSERT INTO record_genres (record_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                      [recResult.rows[0].id, secondGenre]
                    );
                  }
                }
              } catch (err) {
                // skip
              }
            }
          }
        } catch (err) {
          // skip
        }
      }

      if (albumCount % 20 === 0 || recordCount % 100 === 0) {
        console.log(`  → Альбомів: ${albumCount}, Записів: ${recordCount}`);
      }
    } catch (err) {
      console.log(`  ⚠ Помилка для ${artist.name}: ${err.message}`);
      await sleep(2000);
    }
  }

  console.log(`\n  ► Всього альбомів: ${albumCount}`);
  console.log(`  ► Всього записів: ${recordCount}`);
  return { albumCount, recordCount };
}

// ============================================================
// Генерація тестових даних
// ============================================================

async function generateTestData(client) {
  console.log('\n═══ Генерація тестових даних ═══');

  // Отримуємо існуючих артистів та записи
  const recordIds = (await client.query('SELECT id FROM records')).rows.map(r => r.id);
  if (recordIds.length === 0) {
    console.log('  ⚠ Немає записів у БД для генерації тестових даних');
    return;
  }

  // Генерація підписок та користувачів (50+)
  const firstNames = [
    'Олександр', 'Марія', 'Дмитро', 'Анна', 'Максим', 'Тетяна', 'Іван', 'Катерина',
    'Артем', 'Юлія', 'Богдан', 'Оксана', 'Вадим', 'Наталія', 'Євген', 'Ірина',
    'Павло', 'Софія', 'Роман', 'Вікторія', 'Андрій', 'Дарина', 'Олег', 'Аліна',
    'Сергій', 'Яна', 'Микола', 'Лілія', 'Тарас', 'Христина', 'Денис', 'Мілана',
    'Ярослав', 'Поліна', 'Степан', 'Діана', 'Василь', 'Валерія', 'Руслан', 'Ольга',
    'Кирило', 'Маргарита', 'Віталій', 'Анастасія', 'Леонід', 'Людмила', 'Петро', 'Ганна'
  ];
  const lastNames = [
    'Шевченко', 'Коваленко', 'Бондаренко', 'Ткаченко', 'Кравченко', 'Олійник', 'Шевчук',
    'Поліщук', 'Бойко', 'Ткачук', 'Марченко', 'Савченко', 'Руденко', 'Мельник', 'Литвин',
    'Мороз', 'Тарасенко', 'Палій', 'Козак', 'Гончар', 'Сидоренко', 'Василенко', 'Клименко',
    'Панченко', 'Кузьменко', 'Левченко', 'Захарченко', 'Луценко', 'Степаненко', 'Федоренко'
  ];

  let userCount = 0;
  const userIds = [1, 2, 3]; // Системні користувачі вже є

  for (let i = 0; i < 50; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const email = `${firstName.toLowerCase().replace(/[іїєґ]/g, c => ({і:'i',ї:'yi',є:'ye',ґ:'g'}[c]||c))}.${lastName.toLowerCase().replace(/[іїєґ]/g, c => ({і:'i',ї:'yi',є:'ye',ґ:'g'}[c]||c))}${i}@mail.ua`;

    const isPremium = Math.random() > 0.35;
    const validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + Math.floor(Math.random() * 12) + 1);

    try {
      const subResult = await client.query(
        `INSERT INTO subscriptions (subscription_type, status, valid_until, price)
         VALUES ($1, 'active', $2, $3) RETURNING id`,
        [
          isPremium ? 'premium' : 'free',
          validUntil.toISOString().split('T')[0],
          isPremium ? (Math.floor(Math.random() * 5) * 10 + 280) : 0
        ]
      );

      const userResult = await client.query(
        `INSERT INTO users (first_name, last_name, email, subscription_id, role_id)
         VALUES ($1, $2, $3, $4, 3) RETURNING id`,
        [firstName, lastName, email, subResult.rows[0].id]
      );

      userIds.push(userResult.rows[0].id);
      userCount++;
    } catch (err) {
      // skip duplicate emails
    }
  }
  console.log(`  ✓ Створено користувачів: ${userCount}`);

  // Генерація плейлистів
  const playlistNames = [
    'Ранкова підбірка', 'Вечірній хіп-хоп', 'Тренування', 'Українська музика',
    'Рок класика', 'Для роботи', 'Дорога додому', 'Різоні скарби', 'Weekend mix',
    'Спокійний вечір', 'Party Time', 'Мелодії ночі', 'Лайтова музика', 'Хіти тижня'
  ];

  let playlistCount = 0;
  const playlistIds = [];
  for (const uid of userIds) {
    const numPlaylists = Math.floor(Math.random() * 3) + 1;
    for (let p = 0; p < numPlaylists; p++) {
      const plName = playlistNames[Math.floor(Math.random() * playlistNames.length)];
      try {
        const plResult = await client.query(
          `INSERT INTO playlists (title, description, user_id, created_at)
           VALUES ($1, $2, $3, NOW() - ($4 || ' days')::INTERVAL) RETURNING id`,
          [plName, `Плейлист від користувача #${uid}`, uid, Math.floor(Math.random() * 90)]
        );
        const plId = plResult.rows[0].id;
        playlistIds.push(plId);
        playlistCount++;

        // Додаємо треки в плейлист
        const numTracks = Math.floor(Math.random() * 15) + 5;
        const shuffled = [...recordIds].sort(() => Math.random() - 0.5).slice(0, numTracks);
        for (let t = 0; t < shuffled.length; t++) {
          await client.query(
            'INSERT INTO playlist_records (playlist_id, record_id, position) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [plId, shuffled[t], t + 1]
          );
        }
      } catch (err) {
        // skip
      }
    }
  }
  console.log(`  ✓ Створено плейлистів: ${playlistCount}`);

  // Генерація прослуховувань (рівномірно за 365 днів)
  console.log('  → Генерація прослуховувань (це може зайняти хвилину)...');
  let listeningCount = 0;
  const batchSize = 500;
  let values = [];
  let paramList = [];
  let paramIdx = 1;

  for (let i = 0; i < 5000; i++) {
    const userId = userIds[Math.floor(Math.random() * userIds.length)];
    const recordId = recordIds[Math.floor(Math.random() * recordIds.length)];
    const daysAgo = Math.floor(Math.random() * 365);
    const hoursAgo = Math.floor(Math.random() * 24);
    const durationSec = Math.floor(Math.random() * 300) + 30;

    values.push(`($${paramIdx++}, $${paramIdx++}, NOW() - INTERVAL '${daysAgo} days ${hoursAgo} hours', $${paramIdx++})`);
    paramList.push(userId, recordId, durationSec);

    if (values.length >= batchSize || i === 4999) {
      try {
        // Вимикаємо тригер на масову вставку щоб прискорити
        await client.query('ALTER TABLE listenings DISABLE TRIGGER trg_check_subscription_access');
        await client.query(
          `INSERT INTO listenings (user_id, record_id, listened_at, duration_sec) VALUES ${values.join(', ')}`,
          paramList
        );
        await client.query('ALTER TABLE listenings ENABLE TRIGGER trg_check_subscription_access');
        listeningCount += values.length;
      } catch (err) {
        console.log(`  ⚠ Batch insert error: ${err.message}`);
        await client.query('ALTER TABLE listenings ENABLE TRIGGER trg_check_subscription_access');
      }
      values = [];
      paramList = [];
      paramIdx = 1;
    }
  }
  console.log(`  ✓ Створено прослуховувань: ${listeningCount}`);

  // Додаємо кілька подкастів та аудіокниг
  console.log('  → Додаємо подкасти та аудіокниги...');
  const artistIds = (await client.query('SELECT id FROM artists LIMIT 10')).rows.map(r => r.id);

  const podcastTitles = [
    'Техно-подкаст #1', 'Інтерв\'ю з продюсером', 'Історія хіп-хопу', 'Музичні новини',
    'Behind the Beat', 'Studio Sessions #5', 'Рок-культура сьогодні', 'Музичний дайджест',
    'Sound Engineering 101', 'Indie Spotlight', 'The Jazz Corner', 'Electronic Waves',
    'Голос покоління', 'Мелодії міста', 'Rhythm & Reason'
  ];

  const audiobookTitles = [
    'Пригоди Аліси', 'Кобзар - вибране', 'Art of Music', 'Біографія Елтона Джона',
    'Тіні забутих предків', 'Лісова пісня', 'Music Theory Basics', 'The Beatles Anthology',
    'Jazz Historia', 'Rock & Roll Origins'
  ];

  for (const title of podcastTitles) {
    const aid = artistIds[Math.floor(Math.random() * artistIds.length)];
    const length = Math.floor(Math.random() * 2400) + 600; // 10-50 хв
    try {
      const res = await client.query(
        `INSERT INTO records (title, length, type, release_year, artist_id) VALUES ($1,$2,'podcast',$3,$4) RETURNING id`,
        [title, length, 2024 + Math.floor(Math.random() * 3), aid]
      );
      // Assign a genre to podcast
      const genreRes = await client.query(`SELECT id FROM genres WHERE name = 'Indie' LIMIT 1`);
      if (genreRes.rows.length > 0) {
        await client.query(
          'INSERT INTO record_genres (record_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [res.rows[0].id, genreRes.rows[0].id]
        );
      }
    } catch (err) {}
  }

  for (const title of audiobookTitles) {
    const aid = artistIds[Math.floor(Math.random() * artistIds.length)];
    const length = Math.floor(Math.random() * 7200) + 1800; // 30-150 хв
    try {
      await client.query(
        `INSERT INTO records (title, length, type, release_year, artist_id) VALUES ($1,$2,'audiobook',$3,$4)`,
        [title, length, 2020 + Math.floor(Math.random() * 7), aid]
      );
    } catch (err) {}
  }
  console.log(`  ✓ Додано подкастів та аудіокниг`);
}

// ============================================================
// Головна функція
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  AudioLib — Імпорт з MusicBrainz API ║');
  console.log('╚══════════════════════════════════════╝');

  const client = await pool.connect();

  try {
    // Вимикаємо тригери аудиту для масового імпорту
    await client.query('ALTER TABLE artists DISABLE TRIGGER trg_audit_artists');
    await client.query('ALTER TABLE albums DISABLE TRIGGER trg_audit_albums');
    await client.query('ALTER TABLE records DISABLE TRIGGER trg_audit_records');

    const artistMap = await importArtists(client);
    await importAlbumsAndRecords(client, artistMap);
    await generateTestData(client);

    // Вмикаємо тригери аудиту
    await client.query('ALTER TABLE artists ENABLE TRIGGER trg_audit_artists');
    await client.query('ALTER TABLE albums ENABLE TRIGGER trg_audit_albums');
    await client.query('ALTER TABLE records ENABLE TRIGGER trg_audit_records');

    // Фінальна статистика
    const stats = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM artists) AS artists,
        (SELECT COUNT(*) FROM albums) AS albums,
        (SELECT COUNT(*) FROM records) AS records,
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM playlists) AS playlists,
        (SELECT COUNT(*) FROM listenings) AS listenings
    `);

    const s = stats.rows[0];
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║         Підсумок імпорту              ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║ Виконавців: ${String(s.artists).padStart(5)}                    ║`);
    console.log(`║ Альбомів:   ${String(s.albums).padStart(5)}                    ║`);
    console.log(`║ Записів:    ${String(s.records).padStart(5)}                    ║`);
    console.log(`║ Користув.:  ${String(s.users).padStart(5)}                    ║`);
    console.log(`║ Плейлистів: ${String(s.playlists).padStart(5)}                    ║`);
    console.log(`║ Прослухов.: ${String(s.listenings).padStart(5)}                    ║`);
    console.log('╚══════════════════════════════════════╝');

  } catch (err) {
    console.error('\n✗ Критична помилка:', err.message);
    console.error(err.stack);
    // Переконаємось що тригери ввімкнені
    try {
      await client.query('ALTER TABLE artists ENABLE TRIGGER trg_audit_artists');
      await client.query('ALTER TABLE albums ENABLE TRIGGER trg_audit_albums');
      await client.query('ALTER TABLE records ENABLE TRIGGER trg_audit_records');
    } catch (e) {}
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
