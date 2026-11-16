-- STEP 10 - Cutover definitivo al modello account globale + capability.
-- Prerequisito: backup verificato e migration/migration.txt dello STEP 9 gia applicata.
-- Il blocco di validazione interrompe l'esecuzione prima dei DROP se il backfill non e completo.

START TRANSACTION;

INSERT IGNORE INTO `user_capabilities` (
  `user_id`, `capability`, `status`, `onboarding_version`, `current_step`,
  `completed_at`, `activated_at`, `suspended_at`, `disabled_at`, `created_at`, `updated_at`
)
SELECT `id`, 'owner', 'active', 1, 'complete', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 0, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()
FROM `users`;

INSERT IGNORE INTO `user_capabilities` (
  `user_id`, `capability`, `status`, `onboarding_version`, `current_step`,
  `completed_at`, `activated_at`, `suspended_at`, `disabled_at`, `created_at`, `updated_at`
)
SELECT `id`, 'assistant', 'active', 1, 'complete', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 0, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()
FROM `users`
WHERE `role` = 'pet_assistant';

INSERT IGNORE INTO `account_profile` (`user_id`, `name`, `photo`, `age`, `phone`, `created_at`, `updated_at`)
SELECT `user_id`, `name`, `photo`, `age`, `phone`, `created_at`, `updated_at`
FROM `personaldata`;

INSERT IGNORE INTO `owner_profile` (
  `user_id`, `city`, `address`, `address_number`, `location_lat`, `location_lng`, `created_at`, `updated_at`
)
SELECT personal.`user_id`, personal.`city`, personal.`address`, personal.`addressnumber`,
       personal.`location_lat`, personal.`location_lng`, personal.`created_at`, personal.`updated_at`
FROM `personaldata` AS personal
INNER JOIN `users` AS account ON account.`id` = personal.`user_id`
WHERE account.`role` = 'pet_owner';

INSERT IGNORE INTO `assistant_profile` (
  `user_id`, `city`, `address`, `address_number`, `location_lat`, `location_lng`,
  `service_radius_km`, `created_at`, `updated_at`
)
SELECT personal.`user_id`, personal.`city`, personal.`address`, personal.`addressnumber`,
       personal.`location_lat`, personal.`location_lng`, personal.`service_radius_km`,
       personal.`created_at`, personal.`updated_at`
FROM `personaldata` AS personal
INNER JOIN `users` AS account ON account.`id` = personal.`user_id`
WHERE account.`role` = 'pet_assistant';

INSERT IGNORE INTO `profile_reputation` (`user_id`, `capability`, `score`, `updated_at`)
SELECT capability.`user_id`, capability.`capability`,
       COALESCE(legacy.`score`, policy.`value`, 60),
       COALESCE(legacy.`updated_at`, UNIX_TIMESTAMP())
FROM `user_capabilities` AS capability
LEFT JOIN `user_reputation` AS legacy ON legacy.`user_id` = capability.`user_id`
LEFT JOIN `portal_policy` AS policy ON policy.`policy_key` = 'initial_reputation_score';

COMMIT;

DROP PROCEDURE IF EXISTS `cb_validate_step10_cutover`;
DELIMITER //
CREATE PROCEDURE `cb_validate_step10_cutover`()
BEGIN
  IF EXISTS (
    SELECT 1 FROM `users` AS account
    LEFT JOIN `user_capabilities` AS capability
      ON capability.`user_id` = account.`id` AND capability.`capability` = 'owner'
    WHERE capability.`user_id` IS NULL
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'STEP10_ABORT: account senza capability Owner';
  END IF;

  IF EXISTS (
    SELECT 1 FROM `users` AS account
    LEFT JOIN `account_profile` AS profile ON profile.`user_id` = account.`id`
    LEFT JOIN `personaldata` AS legacy ON legacy.`user_id` = account.`id`
    WHERE legacy.`user_id` IS NOT NULL AND profile.`user_id` IS NULL
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'STEP10_ABORT: profilo comune non migrato';
  END IF;

  IF EXISTS (
    SELECT 1 FROM `user_capabilities` AS capability
    LEFT JOIN `profile_reputation` AS reputation
      ON reputation.`user_id` = capability.`user_id`
      AND reputation.`capability` = capability.`capability`
    WHERE reputation.`user_id` IS NULL
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'STEP10_ABORT: reputazione contestuale mancante';
  END IF;
END//
DELIMITER ;

CALL `cb_validate_step10_cutover`();
DROP PROCEDURE `cb_validate_step10_cutover`;

DROP TABLE `personaldata`;
DROP TABLE `user_reputation`;
ALTER TABLE `users` DROP COLUMN `role`;

