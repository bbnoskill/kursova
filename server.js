// ============================================================
// AudioLib — Express API Сервер
// ============================================================

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL підключення
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 12288,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'audiolib',
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Middleware: встановлення користувача для аудиту
app.use((req, res, next) => {
  req.currentUserId = req.headers['x-user-id'] || null;
  next();
});

// Хелпер: встановити user_id у PostgreSQL сесії для тригера аудиту
async function setAuditUser(client, userId) {
  if (userId) {
    await client.query(`SET LOCAL app.current_user_id = '${parseInt(userId)}'`);
  }
}

// ============================================================
// AUTH
// ============================================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.is_deleted,
             ur.name AS role, s.subscription_type, s.status AS sub_status
      FROM users u
      JOIN user_roles ur ON u.role_id = ur.id
      LEFT JOIN subscriptions s ON u.subscription_id = s.id
      WHERE u.email = $1 AND u.is_deleted = FALSE
    `, [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Користувача не знайдено' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Отримати користувача за ID
app.get('/api/auth/user/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.is_deleted,
             ur.name AS role, u.role_id, u.subscription_id,
             s.subscription_type, s.status AS sub_status, s.valid_until, s.price
      FROM users u
      JOIN user_roles ur ON u.role_id = ur.id
      LEFT JOIN subscriptions s ON u.subscription_id = s.id
      WHERE u.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Не знайдено' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DASHBOARD
// ============================================================

app.get('/api/dashboard', async (req, res) => {
  try {
    // Top tracks with fallback: 7 days -> 30 days -> all time
    const topTracksQuery = (interval) => `
      SELECT r.id, r.title, a.name AS artist_name, al.image_url AS album_image, COUNT(l.id) AS cnt
      FROM listenings l
      JOIN records r ON l.record_id = r.id
      JOIN artists a ON r.artist_id = a.id
      LEFT JOIN albums al ON r.album_id = al.id
      ${interval ? `WHERE l.listened_at >= NOW() - INTERVAL '${interval}'` : ''}
      GROUP BY r.id, r.title, a.name, al.image_url
      ORDER BY cnt DESC LIMIT 5
    `;

    const [
      recordCount, listeningCount, activeUsers, artistCount,
      genreStats, subStats
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM records'),
      pool.query(`SELECT COUNT(*) FROM listenings WHERE listened_at >= date_trunc('month', CURRENT_DATE)`),
      pool.query('SELECT COUNT(*) FROM v_active_users'),
      pool.query('SELECT COUNT(*) FROM artists'),
      pool.query(`
        SELECT g.name, COUNT(l.id) AS cnt
        FROM listenings l
        JOIN records r ON l.record_id = r.id
        JOIN record_genres rg ON rg.record_id = r.id
        JOIN genres g ON rg.genre_id = g.id
        WHERE l.listened_at >= date_trunc('month', CURRENT_DATE)
        GROUP BY g.name ORDER BY cnt DESC LIMIT 6
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE subscription_type = 'premium') AS premium,
          COUNT(*) FILTER (WHERE subscription_type = 'free') AS free
        FROM v_active_users
      `)
    ]);

    // Cascade: try 7 days, then 30, then all-time
    let topTracks = await pool.query(topTracksQuery('7 days'));
    let topTracksPeriod = 'week';
    if (topTracks.rows.length === 0) {
      topTracks = await pool.query(topTracksQuery('30 days'));
      topTracksPeriod = 'month';
    }
    if (topTracks.rows.length === 0) {
      topTracks = await pool.query(topTracksQuery(null));
      topTracksPeriod = 'alltime';
    }

    res.json({
      records: parseInt(recordCount.rows[0].count),
      listenings: parseInt(listeningCount.rows[0].count),
      activeUsers: parseInt(activeUsers.rows[0].count),
      artists: parseInt(artistCount.rows[0].count),
      topTracks: topTracks.rows,
      topTracksPeriod,
      genreStats: genreStats.rows,
      subStats: subStats.rows[0] || { premium: 0, free: 0 }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ============================================================
// RECORDS (Каталог)
// ============================================================

app.get('/api/records', async (req, res) => {
  try {
    const { page = 1, limit = 50, genre, search, type, sort = 'title_asc' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = [];
    let params = [];
    let paramIdx = 1;

    if (genre) { where.push(`g.name = $${paramIdx++}`); params.push(genre); }
    if (type) { where.push(`r.type = $${paramIdx++}`); params.push(type); }
    if (search) { where.push(`(r.title ILIKE $${paramIdx} OR a.name ILIKE $${paramIdx})`); params.push(`%${search}%`); paramIdx++; }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    // Total count
    const countQ = `
      SELECT COUNT(DISTINCT r.id) FROM records r
      JOIN artists a ON r.artist_id = a.id
      LEFT JOIN record_genres rg ON rg.record_id = r.id
      LEFT JOIN genres g ON rg.genre_id = g.id
      ${whereClause}
    `;
    const countResult = await pool.query(countQ, params);
    const total = parseInt(countResult.rows[0].count);

    // Data
    const dataQ = `
      SELECT DISTINCT r.id, r.title, r.length, r.type, r.release_year,
             r.artist_id, a.name AS artist_name, r.album_id,
             al.title AS album_title,
             (SELECT string_agg(g2.name, ', ')
              FROM record_genres rg2 JOIN genres g2 ON rg2.genre_id = g2.id
              WHERE rg2.record_id = r.id) AS genres
      FROM records r
      JOIN artists a ON r.artist_id = a.id
      LEFT JOIN albums al ON r.album_id = al.id
      LEFT JOIN record_genres rg ON rg.record_id = r.id
      LEFT JOIN genres g ON rg.genre_id = g.id
      ${whereClause}
      ${sort === 'oldest' ? 'ORDER BY r.id ASC' : 
        sort === 'title_asc' ? 'ORDER BY r.title ASC' : 
        sort === 'title_desc' ? 'ORDER BY r.title DESC' : 
        sort === 'artist_asc' ? 'ORDER BY a.name ASC' : 
        sort === 'duration_desc' ? 'ORDER BY r.length DESC' : 
        'ORDER BY r.id DESC'}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
    params.push(parseInt(limit), offset);
    const dataResult = await pool.query(dataQ, params);

    res.json({
      data: dataResult.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/records/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, a.name AS artist_name, al.title AS album_title,
             (SELECT string_agg(g.name, ', ')
              FROM record_genres rg JOIN genres g ON rg.genre_id = g.id
              WHERE rg.record_id = r.id) AS genres
      FROM records r
      JOIN artists a ON r.artist_id = a.id
      LEFT JOIN albums al ON r.album_id = al.id
      WHERE r.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Не знайдено' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/records', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setAuditUser(client, req.currentUserId);

    const { title, length, type, release_year, artist_id, album_id, genre_ids } = req.body;
    const result = await client.query(
      `INSERT INTO records (title, length, type, release_year, artist_id, album_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, length || 0, type || 'song', release_year, artist_id, album_id || null]
    );
    const record = result.rows[0];

    if (genre_ids && genre_ids.length > 0) {
      for (const gid of genre_ids) {
        await client.query('INSERT INTO record_genres (record_id, genre_id) VALUES ($1, $2)', [record.id, gid]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json(record);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.put('/api/records/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setAuditUser(client, req.currentUserId);

    const { title, length, type, release_year, artist_id, album_id, genre_ids } = req.body;
    const result = await client.query(
      `UPDATE records SET title=$1, length=$2, type=$3, release_year=$4, artist_id=$5, album_id=$6
       WHERE id=$7 RETURNING *`,
      [title, length, type, release_year, artist_id, album_id || null, req.params.id]
    );

    if (genre_ids) {
      await client.query('DELETE FROM record_genres WHERE record_id = $1', [req.params.id]);
      for (const gid of genre_ids) {
        await client.query('INSERT INTO record_genres (record_id, genre_id) VALUES ($1, $2)', [req.params.id, gid]);
      }
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/records/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setAuditUser(client, req.currentUserId);
    await client.query('DELETE FROM records WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
// ARTISTS
// ============================================================

app.get('/api/artists', async (req, res) => {
  try {
    const { page = 1, limit = 50, offset: qOffset, search, country, style, sort = 'name_asc' } = req.query;
    const offset = qOffset !== undefined ? parseInt(qOffset) : (parseInt(page) - 1) * parseInt(limit);
    let where = [];
    let params = [];
    let idx = 1;

    if (country) { where.push(`a.country ILIKE $${idx++}`); params.push(`%${country}%`); }
    if (style) { where.push(`a.style ILIKE $${idx++}`); params.push(`%${style}%`); }
    if (search) { where.push(`a.name ILIKE $${idx++}`); params.push(`%${search}%`); }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM artists a ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await pool.query(`
      SELECT a.*,
             (SELECT COUNT(*) FROM albums WHERE artist_id = a.id) AS album_count,
             (SELECT COUNT(*) FROM records WHERE artist_id = a.id) AS record_count
      FROM artists a ${whereClause}
      ${sort === 'name_desc' ? 'ORDER BY a.name DESC' :
        sort === 'albums_desc' ? 'ORDER BY album_count DESC, a.name ASC' :
        sort === 'records_desc' ? 'ORDER BY record_count DESC, a.name ASC' :
        'ORDER BY a.name ASC'}
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...params, parseInt(limit), offset]);

    res.json({ data: dataResult.rows, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/artists/:id', async (req, res) => {
  try {
    const artist = await pool.query('SELECT * FROM artists WHERE id = $1', [req.params.id]);
    if (artist.rows.length === 0) return res.status(404).json({ error: 'Не знайдено' });

    const albums = await pool.query(`
      SELECT al.*,
             (SELECT string_agg(g.name, ', ') FROM album_genres ag JOIN genres g ON ag.genre_id = g.id WHERE ag.album_id = al.id) AS genres
      FROM albums al WHERE al.artist_id = $1 ORDER BY al.release_year DESC
    `, [req.params.id]);

    const records = await pool.query(`
      SELECT r.*, al.title AS album_title,
             (SELECT string_agg(g.name, ', ') FROM record_genres rg JOIN genres g ON rg.genre_id = g.id WHERE rg.record_id = r.id) AS genres
      FROM records r LEFT JOIN albums al ON r.album_id = al.id
      WHERE r.artist_id = $1 ORDER BY r.album_id, r.title
    `, [req.params.id]);

    res.json({ ...artist.rows[0], albums: albums.rows, records: records.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/artists', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setAuditUser(client, req.currentUserId);
    const { name, country, style } = req.body;
    const result = await client.query(
      'INSERT INTO artists (name, country, style) VALUES ($1, $2, $3) RETURNING *',
      [name, country, style]
    );
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.put('/api/artists/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setAuditUser(client, req.currentUserId);
    const { name, country, style } = req.body;
    const result = await client.query(
      'UPDATE artists SET name=$1, country=$2, style=$3 WHERE id=$4 RETURNING *',
      [name, country, style, req.params.id]
    );
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/artists/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setAuditUser(client, req.currentUserId);
    await client.query('DELETE FROM artists WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
// ALBUMS
// ============================================================

app.get('/api/albums', async (req, res) => {
  try {
    const { artist_id } = req.query;
    let q = `
      SELECT al.*, a.name AS artist_name,
             (SELECT string_agg(g.name, ', ') FROM album_genres ag JOIN genres g ON ag.genre_id = g.id WHERE ag.album_id = al.id) AS genres,
             (SELECT COUNT(*) FROM records WHERE album_id = al.id) AS record_count
      FROM albums al JOIN artists a ON al.artist_id = a.id
    `;
    const params = [];
    if (artist_id) { q += ' WHERE al.artist_id = $1'; params.push(parseInt(artist_id)); }
    q += ' ORDER BY al.release_year DESC';
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/albums', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setAuditUser(client, req.currentUserId);
    const { title, release_year, artist_id, genre_ids } = req.body;
    const result = await client.query(
      'INSERT INTO albums (title, release_year, artist_id) VALUES ($1, $2, $3) RETURNING *',
      [title, release_year, artist_id]
    );
    const album = result.rows[0];
    if (genre_ids && genre_ids.length > 0) {
      for (const gid of genre_ids) {
        await client.query('INSERT INTO album_genres (album_id, genre_id) VALUES ($1, $2)', [album.id, gid]);
      }
    }
    await client.query('COMMIT');
    res.status(201).json(album);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/albums/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setAuditUser(client, req.currentUserId);
    await client.query('DELETE FROM albums WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
// PLAYLISTS
// ============================================================

app.get('/api/playlists', async (req, res) => {
  try {
    const { user_id, sort = 'newest' } = req.query;
    let q = `
      SELECT p.*,
             u.first_name || ' ' || u.last_name AS user_name,
             (SELECT COUNT(*) FROM playlist_records WHERE playlist_id = p.id) AS track_count,
             (SELECT COALESCE(SUM(r.length), 0)
              FROM playlist_records pr JOIN records r ON pr.record_id = r.id
              WHERE pr.playlist_id = p.id) AS total_duration
      FROM playlists p JOIN users u ON p.user_id = u.id
    `;
    const params = [];
    if (user_id) { q += ' WHERE p.user_id = $1'; params.push(parseInt(user_id)); }
    
    if (sort === 'oldest') q += ' ORDER BY p.created_at ASC';
    else if (sort === 'title_asc') q += ' ORDER BY p.title ASC';
    else if (sort === 'title_desc') q += ' ORDER BY p.title DESC';
    else if (sort === 'tracks_desc') q += ' ORDER BY track_count DESC';
    else q += ' ORDER BY p.created_at DESC';
    
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/playlists/:id', async (req, res) => {
  try {
    const playlist = await pool.query(`
      SELECT p.*, u.first_name || ' ' || u.last_name AS user_name
      FROM playlists p JOIN users u ON p.user_id = u.id WHERE p.id = $1
    `, [req.params.id]);
    if (playlist.rows.length === 0) return res.status(404).json({ error: 'Не знайдено' });

    const tracks = await pool.query(`
      SELECT pr.position, r.id, r.title, r.length, r.type, a.name AS artist_name
      FROM playlist_records pr
      JOIN records r ON pr.record_id = r.id
      JOIN artists a ON r.artist_id = a.id
      WHERE pr.playlist_id = $1
      ORDER BY pr.position
    `, [req.params.id]);

    res.json({ ...playlist.rows[0], tracks: tracks.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/playlists', async (req, res) => {
  try {
    const { title, description, user_id } = req.body;
    const result = await pool.query(
      'INSERT INTO playlists (title, description, user_id) VALUES ($1, $2, $3) RETURNING *',
      [title, description || '', user_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/playlists/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM playlists WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Playlist records
app.post('/api/playlists/:id/records', async (req, res) => {
  try {
    const { record_id } = req.body;
    const maxPos = await pool.query(
      'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM playlist_records WHERE playlist_id = $1',
      [req.params.id]
    );
    await pool.query(
      'INSERT INTO playlist_records (playlist_id, record_id, position) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [req.params.id, record_id, maxPos.rows[0].next]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/playlists/:id/records/:recordId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM playlist_records WHERE playlist_id = $1 AND record_id = $2',
      [req.params.id, req.params.recordId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// STATS
// ============================================================

app.get('/api/stats/user/:id', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const result = await pool.query('SELECT * FROM sp_get_user_stats($1, $2)', [req.params.id, days]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats/top', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const limit = parseInt(req.query.limit) || 10;
    const result = await pool.query('SELECT * FROM sp_get_top_records($1, $2)', [days, limit]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats/platform', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const [total, byGenre, byType, byDay] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) AS listenings, COALESCE(SUM(duration_sec), 0) AS total_sec,
               COUNT(DISTINCT user_id) AS unique_users
        FROM listenings WHERE listened_at >= NOW() - ($1 || ' days')::INTERVAL
      `, [days]),
      pool.query(`
        SELECT g.name, COUNT(l.id) AS cnt
        FROM listenings l
        JOIN records r ON l.record_id = r.id
        JOIN record_genres rg ON rg.record_id = r.id
        JOIN genres g ON rg.genre_id = g.id
        WHERE l.listened_at >= NOW() - ($1 || ' days')::INTERVAL
        GROUP BY g.name ORDER BY cnt DESC LIMIT 8
      `, [days]),
      pool.query(`
        SELECT r.type, COUNT(l.id) AS cnt
        FROM listenings l JOIN records r ON l.record_id = r.id
        WHERE l.listened_at >= NOW() - ($1 || ' days')::INTERVAL
        GROUP BY r.type
      `, [days]),
      pool.query(`
        SELECT EXTRACT(DOW FROM listened_at) AS dow, COUNT(*) AS cnt
        FROM listenings
        WHERE listened_at >= NOW() - ($1 || ' days')::INTERVAL
        GROUP BY dow ORDER BY dow
      `, [days])
    ]);

    res.json({
      ...total.rows[0],
      byGenre: byGenre.rows,
      byType: byType.rows,
      byDay: byDay.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SUBSCRIPTIONS
// ============================================================

app.get('/api/subscriptions', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*,
             (SELECT COUNT(*) FROM users WHERE subscription_id = s.id AND is_deleted = FALSE) AS user_count
      FROM subscriptions s ORDER BY s.id
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/subscriptions/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setAuditUser(client, req.currentUserId);
    const { subscription_type, status, valid_until, price } = req.body;
    const result = await client.query(
      `UPDATE subscriptions SET subscription_type=$1, status=$2, valid_until=$3, price=$4 WHERE id=$5 RETURNING *`,
      [subscription_type, status, valid_until, price, req.params.id]
    );
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
// USERS (CRUD)
// ============================================================

app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.created_at, u.is_deleted,
             ur.name AS role, s.subscription_type, s.status AS sub_status
      FROM users u
      JOIN user_roles ur ON u.role_id = ur.id
      LEFT JOIN subscriptions s ON u.subscription_id = s.id
      ORDER BY u.id
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setAuditUser(client, req.currentUserId);
    const { first_name, last_name, email, role_id, subscription_id } = req.body;
    let subId = subscription_id;
    if (!subId) {
      const sub = await client.query(
        `INSERT INTO subscriptions (subscription_type, status, valid_until, price) VALUES ('free','active','2027-12-31',0) RETURNING id`
      );
      subId = sub.rows[0].id;
    }
    const result = await client.query(
      `INSERT INTO users (first_name, last_name, email, role_id, subscription_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [first_name, last_name, email, role_id || 3, subId]
    );
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.put('/api/users/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setAuditUser(client, req.currentUserId);
    const { first_name, last_name, email, role_id, is_deleted } = req.body;
    const result = await client.query(
      `UPDATE users SET first_name=$1, last_name=$2, email=$3, role_id=$4, is_deleted=$5 WHERE id=$6 RETURNING *`,
      [first_name, last_name, email, role_id, is_deleted || false, req.params.id]
    );
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
// AUDIT LOG
// ============================================================

app.get('/api/audit', async (req, res) => {
  try {
    const { operation, table_name, from_date, to_date, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = [];
    let params = [];
    let idx = 1;

    if (operation) { where.push(`al.operation = $${idx++}`); params.push(operation); }
    if (table_name) { where.push(`al.table_name = $${idx++}`); params.push(table_name); }
    if (from_date) { where.push(`al.created_at >= $${idx++}`); params.push(from_date); }
    if (to_date) { where.push(`al.created_at <= $${idx++}`); params.push(to_date); }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM audit_log al ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(`
      SELECT al.*, u.first_name || ' ' || u.last_name AS user_name
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...params, parseInt(limit), offset]);

    res.json({ data: result.rows, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GENRES (допоміжний)
// ============================================================

app.get('/api/genres', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM genres ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// USER ROLES (допоміжний)
// ============================================================

app.get('/api/user-roles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_roles ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ARTISTS CLEANUP (видалення порожніх дублікатів)
// ============================================================

app.delete('/api/artists/cleanup/empty', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setAuditUser(client, req.currentUserId);

    // Find and delete artists with no records and no albums
    const result = await client.query(`
      DELETE FROM artists
      WHERE id IN (
        SELECT a.id FROM artists a
        WHERE NOT EXISTS (SELECT 1 FROM records r WHERE r.artist_id = a.id)
          AND NOT EXISTS (SELECT 1 FROM albums al WHERE al.artist_id = a.id)
      )
      RETURNING id, name
    `);

    await client.query('COMMIT');
    res.json({ success: true, deleted: result.rows, count: result.rowCount });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
// LISTENINGS (для запису прослуховування)
// ============================================================

app.post('/api/listenings', async (req, res) => {
  try {
    const { user_id, record_id, duration_sec } = req.body;
    const result = await pool.query(
      'INSERT INTO listenings (user_id, record_id, duration_sec) VALUES ($1, $2, $3) RETURNING *',
      [user_id, record_id, duration_sec || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// IMPORT (proxy to import script)
// ============================================================

app.post('/api/import/musicbrainz', async (req, res) => {
  try {
    const { spawn } = require('child_process');
    const child = spawn('node', ['scripts/import-musicbrainz.js'], { cwd: __dirname });
    let output = '';
    child.stdout.on('data', d => output += d.toString());
    child.stderr.on('data', d => output += d.toString());
    child.on('close', code => {
      res.json({ success: code === 0, output });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Serve frontend
// ============================================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'AudioLib_Interface.html'));
});

// ============================================================
// Запуск сервера
// ============================================================

app.listen(PORT, () => {
  console.log(`\n  ◈ AudioLib Server`);
  console.log(`  ► http://localhost:${PORT}`);
  console.log(`  ► API: http://localhost:${PORT}/api\n`);
});
