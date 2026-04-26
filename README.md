# AudioLib — Інформаційна система музичної аудіотеки

## Передумови

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14

## Швидкий старт

### 1. Встановлення залежностей

```bash
npm install
```

### 2. Ініціалізація бази даних

Переконайтесь, що PostgreSQL запущений. Стандартне підключення: `postgres:postgres@localhost:5432`.

```bash
npm run db:init
```

Ця команда:
- Створить базу даних `audiolib`
- Виконає `schema.sql` (таблиці, ENUM, FK, індекси)
- Виконає `triggers.sql` (3 тригери)
- Виконає `procedures.sql` (2 процедури + 2 представлення)
- Виконає `seed.sql` (довідникові дані)

### 3. Імпорт даних із MusicBrainz API

```bash
npm run db:import
```

Цей скрипт:
- Завантажує ≥200 виконавців (Hip-Hop, Rock, Pop, R&B)
- Завантажує ≥300 альбомів через MusicBrainz API
- Завантажує ≥1000 аудіозаписів із треклистів
- Генерує 50+ тестових користувачів
- Генерує плейлисти та 5000 прослуховувань

⚠️ Імпорт може зайняти 15-30 хвилин через rate limiting MusicBrainz API (1 запит/сек).

### 4. Запуск сервера

```bash
npm start
```

Відкрити в браузері: **http://localhost:3000**

## Налаштування підключення до БД

Через змінні середовища:

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=audiolib npm start
```

## Структура проєкту

```
├── AudioLib_Interface.html   # Frontend (SPA)
├── server.js                 # Express API сервер
├── package.json              # Node.js залежності
├── db/
│   ├── schema.sql            # DDL: таблиці, ENUM, FK, індекси
│   ├── triggers.sql          # 3 тригери
│   ├── procedures.sql        # 2 процедури + 2 представлення
│   └── seed.sql              # Довідникові дані
├── scripts/
│   ├── init-db.js            # Скрипт ініціалізації БД
│   └── import-musicbrainz.js # Імпорт з MusicBrainz API
└── README.md
```

## Ролі користувачів

| Роль | Доступ |
|------|--------|
| **Адміністратор** | Повний доступ, журнал аудиту, управління користувачами |
| **Контент-менеджер** | CRUD каталогу, додавання виконавців/альбомів |
| **Слухач** | Перегляд каталогу, плейлисти, особиста статистика |

Перемикання ролей доступне через кнопки у бічній панелі.

## API ендпоінти

| Метод | URL | Опис |
|-------|-----|------|
| GET | `/api/dashboard` | KPI + топ треків |
| GET/POST | `/api/records` | Каталог записів |
| GET/PUT/DELETE | `/api/records/:id` | CRUD запису |
| GET/POST | `/api/artists` | Виконавці |
| GET | `/api/artists/:id` | Деталі виконавця |
| GET/POST | `/api/albums` | Альбоми |
| GET/POST | `/api/playlists` | Плейлисти |
| GET | `/api/playlists/:id` | Деталі плейлиста |
| POST/DELETE | `/api/playlists/:id/records` | Треки плейлиста |
| GET | `/api/stats/user/:id` | Статистика користувача |
| GET | `/api/stats/top` | Топ записів |
| GET | `/api/stats/platform` | Статистика платформи |
| GET/PUT | `/api/subscriptions` | Підписки |
| GET/POST/PUT | `/api/users` | Користувачі |
| GET | `/api/audit` | Журнал аудиту |
| GET | `/api/genres` | Довідник жанрів |
| POST | `/api/listenings` | Запис прослуховування |
| POST | `/api/import/musicbrainz` | Запуск імпорту |
