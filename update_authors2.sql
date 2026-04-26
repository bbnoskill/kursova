    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Олексій Технар', 'UA', 'Education') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Олексій Технар' LIMIT 1))) WHERE id = 1201;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Rick Rubin', 'US', 'Talk') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Rick Rubin' LIMIT 1))) WHERE id = 1202;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('DJ Kool Herc', 'JM', 'History') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='DJ Kool Herc' LIMIT 1))) WHERE id = 1203;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('BBC Music', 'UK', 'News') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='BBC Music' LIMIT 1))) WHERE id = 1204;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Questlove', 'US', 'Talk') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Questlove' LIMIT 1))) WHERE id = 1205;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('NPR Music', 'US', 'Live') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='NPR Music' LIMIT 1))) WHERE id = 1206;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Jack Black', 'US', 'Comedy') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Jack Black' LIMIT 1))) WHERE id = 1207;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('The Fantano', 'US', 'Review') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='The Fantano' LIMIT 1))) WHERE id = 1208;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Steve Albini', 'US', 'Education') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Steve Albini' LIMIT 1))) WHERE id = 1209;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('KEXP', 'US', 'Radio') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='KEXP' LIMIT 1))) WHERE id = 1210;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Miles Davis Estate', 'US', 'History') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Miles Davis Estate' LIMIT 1))) WHERE id = 1211;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Resident Advisor', 'UK', 'Electronic') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Resident Advisor' LIMIT 1))) WHERE id = 1212;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Сергій Жадан', 'UA', 'Literature') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Сергій Жадан' LIMIT 1))) WHERE id = 1213;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Київ Радіо', 'UA', 'Radio') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Київ Радіо' LIMIT 1))) WHERE id = 1214;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Complex', 'US', 'Entertainment') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Complex' LIMIT 1))) WHERE id = 1215;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Льюїс Керролл', 'UK', 'Literature') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Льюїс Керролл' LIMIT 1))) WHERE id = 1216;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Тарас Шевченко', 'UA', 'Literature') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Тарас Шевченко' LIMIT 1))) WHERE id = 1217;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Victor Wooten', 'US', 'Education') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Victor Wooten' LIMIT 1))) WHERE id = 1218;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Elton John', 'UK', 'Biography') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Elton John' LIMIT 1))) WHERE id = 1219;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Михайло Коцюбинський', 'UA', 'Literature') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Михайло Коцюбинський' LIMIT 1))) WHERE id = 1220;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Леся Українка', 'UA', 'Literature') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Леся Українка' LIMIT 1))) WHERE id = 1221;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Rick Beato', 'US', 'Education') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Rick Beato' LIMIT 1))) WHERE id = 1222;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('The Beatles', 'UK', 'History') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='The Beatles' LIMIT 1))) WHERE id = 1223;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Ken Burns', 'US', 'Documentary') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Ken Burns' LIMIT 1))) WHERE id = 1224;

    WITH ins AS (INSERT INTO artists (name, country, style) VALUES ('Chuck Berry', 'US', 'History') ON CONFLICT DO NOTHING RETURNING id)
    UPDATE records SET artist_id = (SELECT COALESCE((SELECT id FROM ins LIMIT 1), (SELECT id FROM artists WHERE name='Chuck Berry' LIMIT 1))) WHERE id = 1225;
