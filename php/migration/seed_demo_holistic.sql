-- Aggiunge Operatore olistico a sei Pet Assistant del dataset demo.
-- Richiede il catalogo di sistema e i profili demo gia caricati.

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS `cb_demo_holistic_days`;
DROP TEMPORARY TABLE IF EXISTS `cb_demo_holistic_operators`;

CREATE TEMPORARY TABLE `cb_demo_holistic_operators` AS
SELECT u.id AS user_id, s.id AS service_id,
       20 + 4 * FIELD(u.name, 'utente3', 'utente7', 'utente10', 'utente19', 'utente22', 'utente35') AS hour_price,
       FIELD(u.name, 'utente3', 'utente7', 'utente10', 'utente19', 'utente22', 'utente35') AS profile_number
FROM `users` AS u
JOIN `operatordata` AS profile ON profile.user_id = u.id
CROSS JOIN `service` AS s
WHERE u.role = 'pet_assistant'
  AND u.name IN ('utente3', 'utente7', 'utente10', 'utente19', 'utente22', 'utente35')
  AND u.email = CONCAT(u.name, '@email.it')
  AND s.name = 'Operatore olistico';

INSERT IGNORE INTO `operatorservicedata` (user_id, service_id, hour_price, created_at, updated_at)
SELECT user_id, service_id, hour_price, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()
FROM `cb_demo_holistic_operators`;

INSERT IGNORE INTO `operatorservicefeaturedata` (user_id, service_id, feature_id, created_at, updated_at)
SELECT op.user_id, op.service_id, feature.feature_id, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()
FROM `cb_demo_holistic_operators` AS op
JOIN `servicefeaturedata` AS feature ON feature.service_id = op.service_id
WHERE feature.feature_id = 5 OR MOD(op.profile_number + feature.feature_id, 2) = 0;

CREATE TEMPORARY TABLE `cb_demo_holistic_days` AS
SELECT op.user_id, op.service_id, DATE_ADD(CURRENT_DATE(), INTERVAL offsets.days_ahead DAY) AS available_date
FROM `cb_demo_holistic_operators` AS op
CROSS JOIN (
    SELECT 2 AS days_ahead UNION ALL SELECT 5 UNION ALL SELECT 8 UNION ALL SELECT 11 UNION ALL SELECT 14
    UNION ALL SELECT 17 UNION ALL SELECT 20 UNION ALL SELECT 23 UNION ALL SELECT 26 UNION ALL SELECT 29
) AS offsets;

INSERT INTO `calendar_day` (user_id, `date`, enabled, created_at, updated_at)
SELECT user_id, available_date, 1, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()
FROM `cb_demo_holistic_days`
ORDER BY user_id, available_date
ON DUPLICATE KEY UPDATE enabled = `calendar_day`.enabled;

-- Crea una fascia solo sulle giornate attive che non ne hanno ancora.
INSERT INTO `calendar_day_slot` (calendar_day_id, start_time, end_time, enabled, sortorder, created_at, updated_at)
SELECT day.id, '10:00', '12:00', 1, 1, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()
FROM `cb_demo_holistic_days` AS demo
JOIN `calendar_day` AS day ON day.user_id = demo.user_id AND day.`date` = demo.available_date
WHERE day.enabled = 1
  AND NOT EXISTS (SELECT 1 FROM `calendar_day_slot` AS slot WHERE slot.calendar_day_id = day.id);

-- Associa il servizio a una fascia attiva per giornata, alla tariffa configurata sul profilo.
INSERT IGNORE INTO `calendar_day_slot_service` (slot_id, service_id, enabled, hour_price, created_at, updated_at)
SELECT MIN(slot.id), demo.service_id, 1, op.hour_price, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()
FROM `cb_demo_holistic_days` AS demo
JOIN `calendar_day` AS day ON day.user_id = demo.user_id AND day.`date` = demo.available_date AND day.enabled = 1
JOIN `calendar_day_slot` AS slot ON slot.calendar_day_id = day.id AND slot.enabled = 1
JOIN `operatorservicedata` AS op ON op.user_id = demo.user_id AND op.service_id = demo.service_id
WHERE TIMESTAMPDIFF(MINUTE, CONCAT(day.`date`, ' ', slot.start_time), CONCAT(day.`date`, ' ', slot.end_time)) >= 30
GROUP BY day.id, demo.service_id, op.hour_price;

DROP TEMPORARY TABLE `cb_demo_holistic_days`;
DROP TEMPORARY TABLE `cb_demo_holistic_operators`;

COMMIT;
