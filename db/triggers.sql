-- ============================================================
-- AudioLib — Тригери
-- ============================================================

-- ============================================================
-- 1. trg_check_subscription_access
--    BEFORE INSERT на listenings
--    Перевіряє активну підписку та доступ до преміум-контенту
-- ============================================================

CREATE OR REPLACE FUNCTION fn_check_subscription_access()
RETURNS TRIGGER AS $$
DECLARE
    v_sub_type subscription_type;
    v_sub_status subscription_status;
    v_record_type record_type;
BEGIN
    -- Отримуємо тип та статус підписки користувача
    SELECT s.subscription_type, s.status
    INTO v_sub_type, v_sub_status
    FROM users u
    JOIN subscriptions s ON u.subscription_id = s.id
    WHERE u.id = NEW.user_id AND u.is_deleted = FALSE;

    -- Перевіряємо, чи знайдено користувача з підпискою
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Користувач % не має активної підписки', NEW.user_id;
    END IF;

    -- Перевіряємо статус підписки
    IF v_sub_status != 'active' THEN
        RAISE EXCEPTION 'Підписка користувача % неактивна', NEW.user_id;
    END IF;

    -- Отримуємо тип запису
    SELECT type INTO v_record_type
    FROM records
    WHERE id = NEW.record_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Аудіозапис % не знайдено', NEW.record_id;
    END IF;

    -- Безкоштовна підписка: доступ тільки до song та podcast
    IF v_sub_type = 'free' AND v_record_type = 'audiobook' THEN
        RAISE EXCEPTION 'Аудіокниги доступні лише для Premium підписки';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_subscription_access
    BEFORE INSERT ON listenings
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_subscription_access();

-- ============================================================
-- 2. trg_deactivate_expired_subscriptions
--    BEFORE INSERT OR UPDATE на subscriptions
--    Автоматично деактивує прострочені підписки
-- ============================================================

CREATE OR REPLACE FUNCTION fn_deactivate_expired_subscriptions()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.valid_until IS NOT NULL AND NEW.valid_until < CURRENT_DATE THEN
        NEW.status := 'inactive';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deactivate_expired_subscriptions
    BEFORE INSERT OR UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION fn_deactivate_expired_subscriptions();

-- ============================================================
-- 3. trg_audit_log
--    Записує кожну зміну даних у audit_log
--    Працює на таблицях: users, records, artists, albums, subscriptions
-- ============================================================

CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_record_id INTEGER;
    v_details TEXT;
    v_user_id INTEGER;
BEGIN
    -- Визначаємо ID запису
    IF TG_OP = 'DELETE' THEN
        v_record_id := OLD.id;
    ELSE
        v_record_id := NEW.id;
    END IF;

    -- Формуємо деталі
    IF TG_OP = 'INSERT' THEN
        v_details := 'Створено новий запис';
    ELSIF TG_OP = 'UPDATE' THEN
        v_details := 'Оновлено запис';
    ELSIF TG_OP = 'DELETE' THEN
        v_details := 'Видалено запис';
    END IF;

    -- Записуємо в audit_log
    INSERT INTO audit_log (user_id, operation, table_name, record_id, details)
    VALUES (
        NULLIF(current_setting('app.current_user_id', true), '')::INTEGER,
        TG_OP,
        TG_TABLE_NAME,
        v_record_id,
        v_details
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Тригери аудиту на основних таблицях
CREATE TRIGGER trg_audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_records
    AFTER INSERT OR UPDATE OR DELETE ON records
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_artists
    AFTER INSERT OR UPDATE OR DELETE ON artists
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_albums
    AFTER INSERT OR UPDATE OR DELETE ON albums
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_subscriptions
    AFTER INSERT OR UPDATE OR DELETE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
