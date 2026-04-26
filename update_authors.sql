DO $do
BEGIN
    -- Disable triggers so we don't spam audit logs if not desired, or leave them on. We'll leave them on.
    
    -- Podcasts
    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Олексій Технар', 'UA', 'Education') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Олексій Технар') WHERE id = 1201;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Rick Rubin', 'US', 'Talk') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Rick Rubin') WHERE id = 1202;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('DJ Kool Herc', 'JM', 'History') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='DJ Kool Herc') WHERE id = 1203;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('BBC Music', 'UK', 'News') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='BBC Music') WHERE id = 1204;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Questlove', 'US', 'Talk') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Questlove') WHERE id = 1205;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('NPR Music', 'US', 'Live') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='NPR Music') WHERE id = 1206;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Jack Black', 'US', 'Comedy') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Jack Black') WHERE id = 1207;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('The Fantano', 'US', 'Review') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='The Fantano') WHERE id = 1208;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Steve Albini', 'US', 'Education') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Steve Albini') WHERE id = 1209;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('KEXP', 'US', 'Radio') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='KEXP') WHERE id = 1210;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Miles Davis Estate', 'US', 'History') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Miles Davis Estate') WHERE id = 1211;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Resident Advisor', 'UK', 'Electronic') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Resident Advisor') WHERE id = 1212;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Сергій Жадан', 'UA', 'Literature') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Сергій Жадан') WHERE id = 1213;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Київ Радіо', 'UA', 'Radio') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Київ Радіо') WHERE id = 1214;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Complex', 'US', 'Entertainment') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Complex') WHERE id = 1215;

    -- Audiobooks
    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Льюїс Керролл', 'UK', 'Literature') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Льюїс Керролл') WHERE id = 1216;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Тарас Шевченко', 'UA', 'Literature') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Тарас Шевченко') WHERE id = 1217;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Victor Wooten', 'US', 'Education') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Victor Wooten') WHERE id = 1218;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Elton John', 'UK', 'Biography') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Elton John') WHERE id = 1219;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Михайло Коцюбинський', 'UA', 'Literature') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Михайло Коцюбинський') WHERE id = 1220;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Леся Українка', 'UA', 'Literature') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Леся Українка') WHERE id = 1221;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Rick Beato', 'US', 'Education') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Rick Beato') WHERE id = 1222;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('The Beatles', 'UK', 'History') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='The Beatles') WHERE id = 1223;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Ken Burns', 'US', 'Documentary') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Ken Burns') WHERE id = 1224;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Chuck Berry', 'US', 'History') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT id FROM ins UNION SELECT id FROM artists WHERE name='Chuck Berry') WHERE id = 1225;

END;
$do;
