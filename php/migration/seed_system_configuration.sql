-- Coccole Bestiali - snapshot sistema e configurazione
-- Generato il 2026-11-16 23:04:05 Europe/Rome.
-- Prerequisito: eseguire prima migration/migration.txt.

SET NAMES utf8mb4;
START TRANSACTION;
SET @cb_previous_fk_checks = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM `policy_change_log`;
DELETE FROM `portal_policy`;
DELETE FROM `servicefeaturedata`;
DELETE FROM `service`;
DELETE FROM `servicefeature`;
DELETE FROM `housefeature`;
DELETE FROM `pettype`;
DELETE FROM `petbreed`;
DELETE FROM `operatortitle`;

-- operatortitle: 6 record
INSERT INTO `operatortitle` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (1, 'Addestratore', 10, 1794866628, 1794866628);
INSERT INTO `operatortitle` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (2, 'Educatore', 20, 1794866628, 1794866628);
INSERT INTO `operatortitle` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (3, 'Veterinario', 30, 1794866628, 1794866628);
INSERT INTO `operatortitle` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (4, 'Petsitter', 40, 1794866628, 1794866628);
INSERT INTO `operatortitle` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (5, 'Toelettatore', 50, 1794866628, 1794866628);
INSERT INTO `operatortitle` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (6, 'Operatore Olistico', 60, 1794866628, 1794866628);

-- petbreed: 18 record
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (1, 'Meticcio / Misto', 10, 1794866628, 1794866628);
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (2, 'Labrador Retriever', 20, 1794866628, 1794866628);
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (3, 'Golden Retriever', 30, 1794866628, 1794866628);
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (4, 'Pastore Tedesco', 40, 1794866628, 1794866628);
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (5, 'Bulldog Francese', 50, 1794866628, 1794866628);
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (6, 'Barboncino', 60, 1794866628, 1794866628);
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (7, 'Beagle', 70, 1794866628, 1794866628);
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (8, 'Border Collie', 80, 1794866628, 1794866628);
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (9, 'Chihuahua', 90, 1794866628, 1794866628);
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (10, 'Jack Russell Terrier', 100, 1794866628, 1794866628);
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (11, 'Maltese', 110, 1794866628, 1794866628);
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (12, 'Cocker Spaniel', 120, 1794866628, 1794866628);
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (13, 'Gatto Europeo', 130, 1794866628, 1794866628);
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (14, 'Maine Coon', 140, 1794866628, 1794866628);
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (15, 'Siamese', 150, 1794866628, 1794866628);
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (16, 'Persiano', 160, 1794866628, 1794866628);
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (17, 'Altro', 170, 1794866628, 1794866628);
INSERT INTO `petbreed` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (18, 'Qualsiasi', 0, 1794866628, 1794866628);

-- pettype: 9 record
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (1, 'Docile', 10, 1794866628, 1794866628);
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (2, 'Aggressivo con persone', 20, 1794866628, 1794866628);
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (3, 'Aggressivo con pet', 30, 1794866628, 1794866628);
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (4, 'Ansioso', 40, 1794866628, 1794866628);
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (5, 'Iperattivo', 50, 1794866628, 1794866628);
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (6, 'Anziano', 60, 1794866628, 1794866628);
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (7, 'Cucciolo', 70, 1794866628, 1794866628);
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (8, 'Con esigenze speciali', 80, 1794866628, 1794866628);
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (9, 'Qualsiasi', 0, 1794866628, 1794866628);

-- housefeature: 8 record
INSERT INTO `housefeature` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (1, 'Giardino (recintato SI/NO)', 10, 1794866628, 1794866628);
INSERT INTO `housefeature` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (2, 'Appartamento', 20, 1794866628, 1794866628);
INSERT INTO `housefeature` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (3, 'Casa indipendente', 30, 1794866628, 1794866628);
INSERT INTO `housefeature` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (4, 'Villa', 40, 1794866628, 1794866628);
INSERT INTO `housefeature` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (5, 'Terrazzo (piccolo medio grande)', 50, 1794866628, 1794866628);
INSERT INTO `housefeature` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (6, 'Confinamento (zona dedicata, cuccia interna/esterna, intera casa)', 60, 1794866628, 1794866628);
INSERT INTO `housefeature` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (7, 'Presenza altri animali', 70, 1794866628, 1794866628);
INSERT INTO `housefeature` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (8, 'Presenza ascensore', 80, 1794866628, 1794866628);

-- servicefeature: 7 record
INSERT INTO `servicefeature` (`id`, `name`, `created_at`, `updated_at`) VALUES (1, 'Tracking GPS', 1794866628, 1794866628);
INSERT INTO `servicefeature` (`id`, `name`, `created_at`, `updated_at`) VALUES (2, 'Chat privata', 1794866628, 1794866628);
INSERT INTO `servicefeature` (`id`, `name`, `created_at`, `updated_at`) VALUES (3, 'Note fine servizio', 1794866628, 1794866628);
INSERT INTO `servicefeature` (`id`, `name`, `created_at`, `updated_at`) VALUES (4, 'Invio foto/video', 1794866628, 1794866628);
INSERT INTO `servicefeature` (`id`, `name`, `created_at`, `updated_at`) VALUES (5, 'Incontro preventivo', 1794866628, 1794866628);
INSERT INTO `servicefeature` (`id`, `name`, `created_at`, `updated_at`) VALUES (6, 'Urgenza', 1794866628, 1794866628);
INSERT INTO `servicefeature` (`id`, `name`, `created_at`, `updated_at`) VALUES (7, 'Periodico', 1794866628, 1794866628);

-- service: 6 record
INSERT INTO `service` (`id`, `name`, `description`, `requires_home_photo`, `created_at`, `updated_at`) VALUES (1, 'Passeggiata', 'Passeggiate personalizzate per il tuo pet, con attenzione ai ritmi, al benessere e alle abitudini quotidiane.', 0, 1794866628, 1794866628);
INSERT INTO `service` (`id`, `name`, `description`, `requires_home_photo`, `created_at`, `updated_at`) VALUES (2, 'Soggiorno a domicilio', 'Assistenza direttamente a casa del cliente per garantire continuita, serenita e cura nell\'ambiente abituale del pet.', 0, 1794866628, 1794866628);
INSERT INTO `service` (`id`, `name`, `description`, `requires_home_photo`, `created_at`, `updated_at`) VALUES (3, 'Soggiorno presso il petassistant', 'Ospitalita in ambiente accogliente e controllato presso il petassistant, con presenza costante e cura dedicata.', 1, 1794866628, 1794866628);
INSERT INTO `service` (`id`, `name`, `description`, `requires_home_photo`, `created_at`, `updated_at`) VALUES (4, 'Asilo diurno', 'Accoglienza giornaliera con momenti di gioco, relax e attenzione continua, ideale per assenze durante la giornata.', 0, 1794866628, 1794866628);
INSERT INTO `service` (`id`, `name`, `description`, `requires_home_photo`, `created_at`, `updated_at`) VALUES (5, 'Pet Taxi', 'Trasporto organizzato e affidabile verso veterinari, toelettatori o appuntamenti dedicati alla salute e al benessere del pet.', 0, 1794866628, 1794866628);
INSERT INTO `service` (`id`, `name`, `description`, `requires_home_photo`, `created_at`, `updated_at`) VALUES (6, 'Operatore olistico', 'Incontri dedicati al benessere del pet con un operatore olistico.', 0, 1794866628, 1794866628);

-- servicefeaturedata: 38 record
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (1, 1, 1, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (2, 1, 2, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (3, 1, 3, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (4, 1, 4, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (5, 1, 5, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (6, 1, 6, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (7, 1, 7, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (8, 2, 1, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (9, 2, 2, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (10, 2, 3, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (11, 2, 4, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (12, 2, 5, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (13, 2, 6, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (14, 2, 7, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (15, 3, 1, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (16, 3, 2, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (17, 3, 3, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (18, 3, 4, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (19, 3, 5, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (20, 3, 6, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (21, 3, 7, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (22, 4, 1, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (23, 4, 2, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (24, 4, 3, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (25, 4, 4, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (26, 4, 5, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (27, 4, 6, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (28, 4, 7, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (29, 5, 1, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (30, 5, 2, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (31, 5, 3, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (32, 5, 4, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (33, 5, 5, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (34, 5, 6, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (35, 5, 7, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (36, 6, 5, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (37, 6, 6, 1794866628, 1794866628);
INSERT INTO `servicefeaturedata` (`id`, `service_id`, `feature_id`, `created_at`, `updated_at`) VALUES (38, 6, 7, 1794866628, 1794866628);

-- portal_policy: 11 record
INSERT INTO `portal_policy` (`policy_key`, `value`, `updated_at`) VALUES ('assistant_cutoff_hours', 3, 1794866628);
INSERT INTO `portal_policy` (`policy_key`, `value`, `updated_at`) VALUES ('assistant_late_action_penalty', 5, 1794866628);
INSERT INTO `portal_policy` (`policy_key`, `value`, `updated_at`) VALUES ('booking_min_notice_hours', 24, 1794866628);
INSERT INTO `portal_policy` (`policy_key`, `value`, `updated_at`) VALUES ('initial_reputation_score', 60, 1794866628);
INSERT INTO `portal_policy` (`policy_key`, `value`, `updated_at`) VALUES ('manual_response_hours', 24, 1794866628);
INSERT INTO `portal_policy` (`policy_key`, `value`, `updated_at`) VALUES ('max_booking_duration_minutes', 480, 1794866628);
INSERT INTO `portal_policy` (`policy_key`, `value`, `updated_at`) VALUES ('negative_review_penalty', 5, 1794866628);
INSERT INTO `portal_policy` (`policy_key`, `value`, `updated_at`) VALUES ('owner_free_cancellation_hours', 24, 1794866628);
INSERT INTO `portal_policy` (`policy_key`, `value`, `updated_at`) VALUES ('owner_late_cancellation_penalty', 5, 1794866628);
INSERT INTO `portal_policy` (`policy_key`, `value`, `updated_at`) VALUES ('positive_review_points', 5, 1794866628);
INSERT INTO `portal_policy` (`policy_key`, `value`, `updated_at`) VALUES ('review_window_days', 30, 1794866628);

-- policy_change_log: 0 record

SET FOREIGN_KEY_CHECKS = @cb_previous_fk_checks;
COMMIT;
