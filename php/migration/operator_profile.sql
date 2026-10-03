USE `coccolebestiali`;

CREATE TABLE `operatordata` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL DEFAULT 0,
  `operator_type` varchar(32) NOT NULL DEFAULT 'person',
  `fiscal_code` varchar(32) NOT NULL DEFAULT '',
  `business_name` varchar(255) NOT NULL DEFAULT '',
  `vat_number` varchar(32) NOT NULL DEFAULT '',
  `bio` varchar(4096) NOT NULL DEFAULT '',
  `experience_years` int NOT NULL DEFAULT 0,
  `pet_size` varchar(32) NOT NULL DEFAULT '',
  `service_hour_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` int NOT NULL DEFAULT 0,
  `updated_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_operatordata_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `operatorassociatedata` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL DEFAULT 0,
  `first_name` varchar(255) NOT NULL DEFAULT '',
  `last_name` varchar(255) NOT NULL DEFAULT '',
  `fiscal_code` varchar(32) NOT NULL DEFAULT '',
  `created_at` int NOT NULL DEFAULT 0,
  `updated_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_operatorassociatedata_user_id` (`user_id`),
  KEY `idx_operatorassociatedata_fiscal_code` (`fiscal_code`)
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

CREATE TABLE `petbreed` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(160) NOT NULL DEFAULT '',
  `sortorder` int NOT NULL DEFAULT 0,
  `created_at` int NOT NULL DEFAULT 0,
  `updated_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `petbreeddata` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL DEFAULT 0,
  `petbreed_id` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` int NOT NULL DEFAULT 0,
  `updated_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_petbreeddata_user_breed` (`user_id`, `petbreed_id`),
  KEY `idx_petbreeddata_user_id` (`user_id`),
  KEY `idx_petbreeddata_breed_id` (`petbreed_id`)
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

INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES
  (18, 'Qualsiasi', 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (1, 'Meticcio / Misto', 10, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (2, 'Labrador Retriever', 20, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (3, 'Golden Retriever', 30, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (4, 'Pastore Tedesco', 40, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (5, 'Bulldog Francese', 50, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (6, 'Barboncino', 60, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (7, 'Beagle', 70, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (8, 'Border Collie', 80, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (9, 'Chihuahua', 90, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (10, 'Jack Russell Terrier', 100, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (11, 'Maltese', 110, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (12, 'Cocker Spaniel', 120, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (13, 'Gatto Europeo', 130, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (14, 'Maine Coon', 140, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (15, 'Siamese', 150, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (16, 'Persiano', 160, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  (17, 'Altro', 170, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `sortorder` = VALUES(`sortorder`),
  `updated_at` = UNIX_TIMESTAMP();
