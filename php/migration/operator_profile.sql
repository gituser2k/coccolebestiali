USE `coccolebestiali`;

CREATE TABLE `operatordata` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL DEFAULT 0,
  `bio` varchar(4096) NOT NULL DEFAULT '',
  `experience_years` int NOT NULL DEFAULT 0,
  `dog_weight_limit` int NOT NULL DEFAULT 0,
  `service_hour_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` int NOT NULL DEFAULT 0,
  `updated_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_operatordata_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `operatortitle` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL DEFAULT '',
  `sortorder` int NOT NULL DEFAULT 0,
  `created_at` int NOT NULL DEFAULT 0,
  `updated_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `operatortitledata` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL DEFAULT 0,
  `title_id` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` int NOT NULL DEFAULT 0,
  `updated_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_operatortitledata_user_title` (`user_id`, `title_id`),
  KEY `idx_operatortitledata_user_id` (`user_id`),
  KEY `idx_operatortitledata_title_id` (`title_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `dogbreed` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(160) NOT NULL DEFAULT '',
  `sortorder` int NOT NULL DEFAULT 0,
  `created_at` int NOT NULL DEFAULT 0,
  `updated_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `dogbreeddata` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL DEFAULT 0,
  `breed_id` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` int NOT NULL DEFAULT 0,
  `updated_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dogbreeddata_user_breed` (`user_id`, `breed_id`),
  KEY `idx_dogbreeddata_user_id` (`user_id`),
  KEY `idx_dogbreeddata_breed_id` (`breed_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `operatorgallery` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL DEFAULT 0,
  `photo` varchar(1024) NOT NULL DEFAULT '',
  `caption` varchar(255) NOT NULL DEFAULT '',
  `sortorder` int NOT NULL DEFAULT 0,
  `created_at` int NOT NULL DEFAULT 0,
  `updated_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_operatorgallery_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `operatortitle` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES
  (1, 'Addestratore', 10, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (2, 'Educatore', 20, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (3, 'Veterinario', 30, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (4, 'Petsitter', 40, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (5, 'Toelettatore', 50, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `sortorder` = VALUES(`sortorder`),
  `updated_at` = UNIX_TIMESTAMP();

INSERT INTO `dogbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES
  (1, 'Labrador Retriever', 10, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (2, 'Golden Retriever', 20, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (3, 'Pastore Tedesco', 30, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (4, 'Bulldog Francese', 40, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (5, 'Barboncino', 50, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (6, 'Beagle', 60, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (7, 'Carlino', 70, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (8, 'Border Collie', 80, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (9, 'Chihuahua', 90, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (10, 'Jack Russell Terrier', 100, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (11, 'Maltese', 110, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (12, 'Rottweiler', 120, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (13, 'Setter Inglese', 130, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (14, 'Cocker Spaniel', 140, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (15, 'Meticcio', 150, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `sortorder` = VALUES(`sortorder`),
  `updated_at` = UNIX_TIMESTAMP();
