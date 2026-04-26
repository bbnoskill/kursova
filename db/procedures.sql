-- ============================================================
-- AudioLib — Збережені процедури та представлення
-- ============================================================

-- ============================================================
-- ПРОЦЕДУРА 1: sp_get_user_stats
-- Агрегована статистика прослуховувань конкретного користувача
-- за вказану кількість останніх днів
-- ============================================================

CREATE OR REPLACE FUNCTION sp_get_user_stats(
    p_user_id INTEGER,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_listenings BIGINT,
    total_seconds    BIGINT,
    top_artists      JSON,
    top_records      JSON
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)
         FROM listenings l
         WHERE l.user_id = p_user_id
           AND l.listened_at >= NOW() - (p_days || ' days')::INTERVAL
        ) AS total_listenings,

        (SELECT COALESCE(SUM(l.duration_sec), 0)
         FROM listenings l
         WHERE l.user_id = p_user_id
           AND l.listened_at >= NOW() - (p_days || ' days')::INTERVAL
        ) AS total_seconds,

        (SELECT json_agg(row_to_json(t))
         FROM (
             SELECT a.id, a.name, COUNT(*) AS listen_count
             FROM listenings l
             JOIN records r ON l.record_id = r.id
             JOIN artists a ON r.artist_id = a.id
             WHERE l.user_id = p_user_id
               AND l.listened_at >= NOW() - (p_days || ' days')::INTERVAL
             GROUP BY a.id, a.name
             ORDER BY listen_count DESC
             LIMIT 5
         ) t
        ) AS top_artists,

        (SELECT json_agg(row_to_json(t))
         FROM (
             SELECT r.id, r.title, a.name AS artist_name, COUNT(*) AS listen_count
             FROM listenings l
             JOIN records r ON l.record_id = r.id
             JOIN artists a ON r.artist_id = a.id
             WHERE l.user_id = p_user_id
               AND l.listened_at >= NOW() - (p_days || ' days')::INTERVAL
             GROUP BY r.id, r.title, a.name
             ORDER BY listen_count DESC
             LIMIT 5
         ) t
        ) AS top_records;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ПРОЦЕДУРА 2: sp_get_top_records
-- Найпопулярніші аудіозаписи за кількістю прослуховувань
-- за вказаний часовий діапазон
-- ============================================================

CREATE OR REPLACE FUNCTION sp_get_top_records(
    p_days INTEGER DEFAULT 30,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    record_id     INTEGER,
    title         VARCHAR,
    artist_name   VARCHAR,
    genres        TEXT,
    listen_count  BIGINT,
    total_seconds BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id AS record_id,
        r.title,
        a.name AS artist_name,
        (SELECT string_agg(g.name, ', ')
         FROM record_genres rg
         JOIN genres g ON rg.genre_id = g.id
         WHERE rg.record_id = r.id
        ) AS genres,
        COUNT(l.id) AS listen_count,
        COALESCE(SUM(l.duration_sec), 0) AS total_seconds
    FROM listenings l
    JOIN records r ON l.record_id = r.id
    JOIN artists a ON r.artist_id = a.id
    WHERE l.listened_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY r.id, r.title, a.name
    ORDER BY listen_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ПРЕДСТАВЛЕННЯ 1: v_active_users
-- Користувачі з поточною активною підпискою
-- ============================================================

CREATE OR REPLACE VIEW v_active_users AS
SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    u.created_at,
    ur.name AS role,
    s.subscription_type,
    s.status AS subscription_status,
    s.valid_until
FROM users u
JOIN user_roles ur ON u.role_id = ur.id
JOIN subscriptions s ON u.subscription_id = s.id
WHERE u.is_deleted = FALSE
  AND s.status = 'active';

-- ============================================================
-- ПРЕДСТАВЛЕННЯ 2: v_record_popularity
-- Агрегована інформація про популярність аудіозаписів
-- ============================================================

CREATE OR REPLACE VIEW v_record_popularity AS
SELECT
    r.id,
    r.title,
    a.name AS artist_name,
    r.type,
    r.release_year,
    COUNT(l.id) AS total_listenings,
    COALESCE(SUM(l.duration_sec), 0) AS total_play_time,
    CASE
        WHEN COUNT(l.id) FILTER (
            WHERE l.listened_at >= NOW() - INTERVAL '30 days'
        ) > 100 THEN TRUE
        ELSE FALSE
    END AS is_popular
FROM records r
JOIN artists a ON r.artist_id = a.id
LEFT JOIN listenings l ON l.record_id = r.id
GROUP BY r.id, r.title, a.name, r.type, r.release_year;
