-- Estensione incrementale del calendario dimostrativo fino al 31 dicembre 2027.
--
-- Lo script e' ripetibile e non elimina dati. Interviene esclusivamente sugli
-- account Pet Assistant dimostrativi riconosciuti per email, conserva eventuali
-- giornate gia' presenti e replica per ciascun giorno della settimana l'ultima
-- configurazione disponibile nel 2026 (stato, fasce, servizi e tariffe).

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS `cb_demo_target_users`;
CREATE TEMPORARY TABLE `cb_demo_target_users` (
  `user_id` int unsigned NOT NULL,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB;

INSERT IGNORE INTO `cb_demo_target_users` (`user_id`)
SELECT `u`.`id`
FROM `users` AS `u`
INNER JOIN `user_capabilities` AS `capability`
  ON `capability`.`user_id` = `u`.`id`
 AND `capability`.`capability` = 'assistant'
WHERE `u`.`email` REGEXP '^utente([1-9]|[1-3][0-9]|40)@email\\.it$'
   OR `u`.`email` = 'devfra75@gmail.com';

DROP TEMPORARY TABLE IF EXISTS `cb_demo_dates`;
CREATE TEMPORARY TABLE `cb_demo_dates` (
  `date` date NOT NULL,
  PRIMARY KEY (`date`)
) ENGINE=InnoDB;

INSERT INTO `cb_demo_dates` (`date`)
WITH RECURSIVE `dates` AS (
  SELECT DATE('2027-01-01') AS `date`
  UNION ALL
  SELECT DATE_ADD(`date`, INTERVAL 1 DAY)
  FROM `dates`
  WHERE `date` < DATE('2027-12-31')
)
SELECT `date` FROM `dates`;

DROP TEMPORARY TABLE IF EXISTS `cb_demo_source_days`;
CREATE TEMPORARY TABLE `cb_demo_source_days` (
  `user_id` int unsigned NOT NULL,
  `weekday_number` tinyint unsigned NOT NULL,
  `source_day_id` int unsigned NOT NULL,
  PRIMARY KEY (`user_id`, `weekday_number`)
) ENGINE=InnoDB;

INSERT INTO `cb_demo_source_days` (`user_id`, `weekday_number`, `source_day_id`)
SELECT `latest`.`user_id`, `latest`.`weekday_number`, `source_day`.`id`
FROM (
  SELECT
    `day`.`user_id`,
    WEEKDAY(`day`.`date`) AS `weekday_number`,
    MAX(`day`.`date`) AS `source_date`
  FROM `calendar_day` AS `day`
  INNER JOIN `cb_demo_target_users` AS `target_user`
    ON `target_user`.`user_id` = `day`.`user_id`
  WHERE `day`.`date` < DATE('2027-01-01')
  GROUP BY `day`.`user_id`, WEEKDAY(`day`.`date`)
) AS `latest`
INNER JOIN `calendar_day` AS `source_day`
  ON `source_day`.`user_id` = `latest`.`user_id`
 AND `source_day`.`date` = `latest`.`source_date`;

INSERT IGNORE INTO `calendar_day` (
  `user_id`, `date`, `enabled`, `created_at`, `updated_at`
)
SELECT
  `target_user`.`user_id`,
  `target_date`.`date`,
  COALESCE(`source_day`.`enabled`, 1),
  UNIX_TIMESTAMP(),
  UNIX_TIMESTAMP()
FROM `cb_demo_target_users` AS `target_user`
CROSS JOIN `cb_demo_dates` AS `target_date`
LEFT JOIN `cb_demo_source_days` AS `source_map`
  ON `source_map`.`user_id` = `target_user`.`user_id`
 AND `source_map`.`weekday_number` = WEEKDAY(`target_date`.`date`)
LEFT JOIN `calendar_day` AS `source_day`
  ON `source_day`.`id` = `source_map`.`source_day_id`;

INSERT INTO `calendar_day_slot` (
  `calendar_day_id`, `start_time`, `end_time`, `enabled`, `sortorder`, `created_at`, `updated_at`
)
SELECT
  `target_day`.`id`,
  `source_slot`.`start_time`,
  `source_slot`.`end_time`,
  `source_slot`.`enabled`,
  `source_slot`.`sortorder`,
  UNIX_TIMESTAMP(),
  UNIX_TIMESTAMP()
FROM `calendar_day` AS `target_day`
INNER JOIN `cb_demo_target_users` AS `target_user`
  ON `target_user`.`user_id` = `target_day`.`user_id`
INNER JOIN `cb_demo_dates` AS `target_date`
  ON `target_date`.`date` = `target_day`.`date`
INNER JOIN `cb_demo_source_days` AS `source_map`
  ON `source_map`.`user_id` = `target_day`.`user_id`
 AND `source_map`.`weekday_number` = WEEKDAY(`target_day`.`date`)
INNER JOIN `calendar_day_slot` AS `source_slot`
  ON `source_slot`.`calendar_day_id` = `source_map`.`source_day_id`
WHERE NOT EXISTS (
  SELECT 1
  FROM `calendar_day_slot` AS `existing_slot`
  WHERE `existing_slot`.`calendar_day_id` = `target_day`.`id`
    AND `existing_slot`.`start_time` = `source_slot`.`start_time`
    AND `existing_slot`.`end_time` = `source_slot`.`end_time`
    AND `existing_slot`.`sortorder` = `source_slot`.`sortorder`
);

INSERT IGNORE INTO `calendar_day_slot_service` (
  `slot_id`, `service_id`, `enabled`, `hour_price`, `created_at`, `updated_at`
)
SELECT
  `target_slot`.`id`,
  `source_service`.`service_id`,
  `source_service`.`enabled`,
  `source_service`.`hour_price`,
  UNIX_TIMESTAMP(),
  UNIX_TIMESTAMP()
FROM `calendar_day` AS `target_day`
INNER JOIN `cb_demo_target_users` AS `target_user`
  ON `target_user`.`user_id` = `target_day`.`user_id`
INNER JOIN `cb_demo_dates` AS `target_date`
  ON `target_date`.`date` = `target_day`.`date`
INNER JOIN `cb_demo_source_days` AS `source_map`
  ON `source_map`.`user_id` = `target_day`.`user_id`
 AND `source_map`.`weekday_number` = WEEKDAY(`target_day`.`date`)
INNER JOIN `calendar_day_slot` AS `source_slot`
  ON `source_slot`.`calendar_day_id` = `source_map`.`source_day_id`
INNER JOIN `calendar_day_slot` AS `target_slot`
  ON `target_slot`.`calendar_day_id` = `target_day`.`id`
 AND `target_slot`.`start_time` = `source_slot`.`start_time`
 AND `target_slot`.`end_time` = `source_slot`.`end_time`
 AND `target_slot`.`sortorder` = `source_slot`.`sortorder`
INNER JOIN `calendar_day_slot_service` AS `source_service`
  ON `source_service`.`slot_id` = `source_slot`.`id`;

DROP TEMPORARY TABLE IF EXISTS `cb_demo_source_days`;
DROP TEMPORARY TABLE IF EXISTS `cb_demo_dates`;
DROP TEMPORARY TABLE IF EXISTS `cb_demo_target_users`;

COMMIT;
