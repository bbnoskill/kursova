-- ============================================================
-- AudioLib — Очищення порожніх дублікатів виконавців
-- Видаляє артистів, до яких не прив'язано жодного запису або альбому
-- ============================================================

-- Крок 1: Переглянути що буде видалено
SELECT a.id, a.name, a.country, a.style
FROM artists a
WHERE NOT EXISTS (SELECT 1 FROM records r WHERE r.artist_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM albums al WHERE al.artist_id = a.id)
ORDER BY a.name;

-- Крок 2: Видалити порожніх артистів
DELETE FROM artists
WHERE id IN (
    SELECT a.id
    FROM artists a
    WHERE NOT EXISTS (SELECT 1 FROM records r WHERE r.artist_id = a.id)
      AND NOT EXISTS (SELECT 1 FROM albums al WHERE al.artist_id = a.id)
);
