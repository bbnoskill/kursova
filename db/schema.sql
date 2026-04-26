-- ============================================================
-- AudioLib — Схема бази даних
-- Курсова робота: Інформаційна система музичної аудіотеки
-- ============================================================

-- Видалення існуючих об'єктів (для повторного запуску)
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- ============================================================
-- ENUM типи
-- ============================================================

CREATE TYPE record_type AS ENUM ('song', 'podcast', 'audiobook');
CREATE TYPE subscription_type AS ENUM ('free', 'premium');
CREATE TYPE subscription_status AS ENUM ('active', 'inactive');
CREATE TYPE role_name AS ENUM ('admin', 'content_manager', 'listener');

-- ============================================================
-- 1. user_roles — класифікатор ролей
-- ============================================================

CREATE TABLE user_roles (
    id    SERIAL PRIMARY KEY,
    name  role_name NOT NULL UNIQUE,
    description TEXT
);

-- ============================================================
-- 2. subscriptions — підписки
-- ============================================================

CREATE TABLE subscriptions (
    id                SERIAL PRIMARY KEY,
    subscription_type subscription_type NOT NULL DEFAULT 'free',
    status            subscription_status NOT NULL DEFAULT 'active',
    valid_until       DATE,
    price             NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. users — облікові записи користувачів
-- ============================================================

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
    role_id         INTEGER NOT NULL REFERENCES user_roles(id) ON DELETE RESTRICT,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================
-- 4. artists — виконавці
-- ============================================================

CREATE TABLE artists (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    style   VARCHAR(100)
);

-- ============================================================
-- 5. albums — альбоми
-- ============================================================

CREATE TABLE albums (
    id           SERIAL PRIMARY KEY,
    title        VARCHAR(255) NOT NULL,
    release_year INTEGER,
    artist_id    INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE
);

-- ============================================================
-- 6. records — аудіозаписи
-- ============================================================

CREATE TABLE records (
    id           SERIAL PRIMARY KEY,
    title        VARCHAR(255) NOT NULL,
    length       INTEGER NOT NULL DEFAULT 0,          -- тривалість у секундах
    type         record_type NOT NULL DEFAULT 'song',
    release_year INTEGER,
    artist_id    INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    album_id     INTEGER REFERENCES albums(id) ON DELETE SET NULL  -- може бути NULL (сингл)
);

-- ============================================================
-- 7. genres — довідник жанрів
-- ============================================================

CREATE TABLE genres (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- ============================================================
-- 8. record_genres — зв'язок M:N записи ↔ жанри
-- ============================================================

CREATE TABLE record_genres (
    record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    genre_id  INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (record_id, genre_id)
);

-- ============================================================
-- 9. album_genres — зв'язок M:N альбоми ↔ жанри
-- ============================================================

CREATE TABLE album_genres (
    album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (album_id, genre_id)
);

-- ============================================================
-- 10. playlists — плейлисти користувачів
-- ============================================================

CREATE TABLE playlists (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    description TEXT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- playlist_records — зв'язок M:N плейлисти ↔ записи
-- ============================================================

CREATE TABLE playlist_records (
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    record_id   INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (playlist_id, record_id)
);

-- ============================================================
-- 11. listenings — подія прослуховування (транзакційна)
-- ============================================================

CREATE TABLE listenings (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    record_id    INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    listened_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    duration_sec INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- audit_log — журнал аудиту (системна)
-- ============================================================

CREATE TABLE audit_log (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER,
    operation   VARCHAR(10) NOT NULL,   -- INSERT, UPDATE, DELETE
    table_name  VARCHAR(100) NOT NULL,
    record_id   INTEGER,
    details     TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ІНДЕКСИ (5 штук відповідно до звіту)
-- ============================================================

-- 1. Прискорення статистики прослуховувань конкретного користувача
CREATE INDEX idx_listenings_user_id ON listenings(user_id);

-- 2. Ефективна фільтрація подій за часовим діапазоном
CREATE INDEX idx_listenings_listened_at ON listenings(listened_at);

-- 3. Прискорення вибірки аудіозаписів за виконавцем
CREATE INDEX idx_records_artist_id ON records(artist_id);

-- 4. Пошук облікового запису при автентифікації
CREATE INDEX idx_users_email ON users(email);

-- 5. Фільтрація каталогу за роком та типом запису
CREATE INDEX idx_records_year_type ON records(release_year, type);
