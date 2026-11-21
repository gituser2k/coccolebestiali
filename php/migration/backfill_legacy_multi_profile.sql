-- Backfill non distruttivo per database legacy con users.role e personaldata.
-- Non elimina le tabelle o le colonne storiche: il cutover distruttivo resta
-- separato in step10_finalize_multi_profile.sql.

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
SELECT `account`.`id`, 'assistant', 'active', 1, 'complete', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 0, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()
FROM `users` AS `account`
INNER JOIN `operatordata` AS `operator` ON `operator`.`user_id` = `account`.`id`;

INSERT IGNORE INTO `account_profile` (`user_id`, `name`, `photo`, `age`, `phone`, `created_at`, `updated_at`)
SELECT `user_id`, `name`, `photo`, `age`, `phone`, `created_at`, `updated_at`
FROM `personaldata`;

INSERT IGNORE INTO `owner_profile` (
  `user_id`, `city`, `address`, `address_number`, `location_lat`, `location_lng`, `created_at`, `updated_at`
)
SELECT `personal`.`user_id`, `personal`.`city`, `personal`.`address`, `personal`.`addressnumber`,
       `personal`.`location_lat`, `personal`.`location_lng`, `personal`.`created_at`, `personal`.`updated_at`
FROM `personaldata` AS `personal`
INNER JOIN `users` AS `account` ON `account`.`id` = `personal`.`user_id`
WHERE `account`.`role` = 'pet_owner';

INSERT IGNORE INTO `assistant_profile` (
  `user_id`, `city`, `address`, `address_number`, `location_lat`, `location_lng`,
  `service_radius_km`, `created_at`, `updated_at`
)
SELECT `personal`.`user_id`, `personal`.`city`, `personal`.`address`, `personal`.`addressnumber`,
       `personal`.`location_lat`, `personal`.`location_lng`, `personal`.`service_radius_km`,
       `personal`.`created_at`, `personal`.`updated_at`
FROM `personaldata` AS `personal`
INNER JOIN `operatordata` AS `operator` ON `operator`.`user_id` = `personal`.`user_id`;

INSERT IGNORE INTO `profile_reputation` (`user_id`, `capability`, `score`, `updated_at`)
SELECT `capability`.`user_id`, `capability`.`capability`,
       COALESCE(`legacy`.`score`, `policy`.`value`, 60),
       COALESCE(`legacy`.`updated_at`, UNIX_TIMESTAMP())
FROM `user_capabilities` AS `capability`
LEFT JOIN `user_reputation` AS `legacy` ON `legacy`.`user_id` = `capability`.`user_id`
LEFT JOIN `portal_policy` AS `policy` ON `policy`.`policy_key` = 'initial_reputation_score';

COMMIT;
