-- ============================================================
-- AudioLib — Початкові (довідникові) дані
-- ============================================================

-- Ролі користувачів
INSERT INTO user_roles (name, description) VALUES
    ('admin', 'Повний доступ до всіх розділів системи'),
    ('content_manager', 'Управління каталогом аудіозаписів'),
    ('listener', 'Перегляд каталогу та прослуховування');

-- Жанри
INSERT INTO genres (name) VALUES
    ('Rock'), ('Hip-Hop'), ('R&B'), ('Pop'), ('Grime'),
    ('Jazz'), ('Electronic'), ('Classical'), ('Folk'), ('Indie'),
    ('Metal'), ('Punk'), ('Blues'), ('Soul'), ('Reggae'),
    ('Country'), ('Latin'), ('Alternative'), ('Funk'), ('Disco');

-- Базові підписки
-- ID=1: спільна Free підписка
INSERT INTO subscriptions (subscription_type, status, valid_until, price)
VALUES ('free', 'active', '2027-12-31', 0);

-- ID=2: Premium підписка для адміна
INSERT INTO subscriptions (subscription_type, status, valid_until, price)
VALUES ('premium', 'active', '2027-06-30', 300);

-- ID=3: Premium підписка для менеджера
INSERT INTO subscriptions (subscription_type, status, valid_until, price)
VALUES ('premium', 'active', '2027-06-30', 300);

-- Системні користувачі
INSERT INTO users (first_name, last_name, email, subscription_id, role_id) VALUES
    ('Адмін', 'Системний', 'admin@audiolib.ua', 2, 1),
    ('Контент', 'Менеджер', 'manager@audiolib.ua', 3, 2),
    ('Андрієвський', 'В.', 'andrievskyi@audiolib.ua', 2, 3);
