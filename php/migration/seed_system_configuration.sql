-- Coccole Bestiali - snapshot sistema e configurazione
-- Generato il 2026-11-21 16:03:28 Europe/Rome.
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
INSERT INTO `operatortitle` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (1, 'Addestratore', 10, 1794866628, 1795273407);
INSERT INTO `operatortitle` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (2, 'Educatore', 20, 1794866628, 1795273407);
INSERT INTO `operatortitle` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (3, 'Veterinario', 30, 1794866628, 1795273407);
INSERT INTO `operatortitle` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (4, 'Petsitter', 40, 1794866628, 1795273407);
INSERT INTO `operatortitle` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (5, 'Toelettatore', 50, 1794866628, 1795273407);
INSERT INTO `operatortitle` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (6, 'Operatore Olistico', 60, 1794866628, 1795273407);

-- petbreed: 40 record
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (101, 'Cani', 'Cani da pastore e bovari', 1010, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (102, 'Cani', 'Pinscher, Schnauzer, Molossi e bovari svizzeri', 1020, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (103, 'Cani', 'Terrier', 1030, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (104, 'Cani', 'Bassotti', 1040, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (105, 'Cani', 'Spitz e tipo primitivo', 1050, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (106, 'Cani', 'Segugi e cani per pista di sangue', 1060, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (107, 'Cani', 'Cani da ferma', 1070, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (108, 'Cani', 'Cani da riporto, da cerca e da acqua', 1080, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (109, 'Cani', 'Cani da compagnia', 1090, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (110, 'Cani', 'Levrieri', 1100, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (111, 'Cani', 'Meticci e non classificati', 1110, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (201, 'Gatti', 'Pelo lungo e persiani/esotici', 2010, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (202, 'Gatti', 'Pelo semilungo', 2020, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (203, 'Gatti', 'Pelo corto e somali', 2030, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (204, 'Gatti', 'Orientali, siamesi e affini', 2040, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (205, 'Gatti', 'Gatti domestici, meticci o non classificati', 2050, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (301, 'Conigli', 'Conigli nani e piccoli', 3010, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (302, 'Conigli', 'Conigli medi', 3020, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (303, 'Conigli', 'Conigli grandi e giganti', 3030, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (304, 'Conigli', 'Conigli ariete e a pelo lungo', 3040, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (401, 'Furetti', 'Furetti', 4010, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (411, 'Piccoli mammiferi', 'Criceti, gerbilli, topi e ratti domestici', 4110, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (412, 'Piccoli mammiferi', 'Cavie e porcellini d’India', 4120, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (413, 'Piccoli mammiferi', 'Cincillà e degu', 4130, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (414, 'Piccoli mammiferi', 'Ricci domestici e altri piccoli insettivori', 4140, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (415, 'Piccoli mammiferi', 'Altri piccoli mammiferi da compagnia', 4150, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (501, 'Uccelli', 'Psittaciformi · pappagalli e parrocchetti', 5010, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (502, 'Uccelli', 'Passeriformi · canarini, fringillidi e affini', 5020, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (503, 'Uccelli', 'Columbiformi e altri uccelli ornamentali', 5030, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (504, 'Uccelli', 'Uccelli da cortile tenuti come compagnia', 5040, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (601, 'Rettili', 'Sauri · lucertole, gechi e iguane', 6010, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (602, 'Rettili', 'Cheloni · tartarughe terrestri e acquatiche', 6020, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (603, 'Rettili', 'Serpenti e altri rettili', 6030, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (701, 'Anfibi', 'Anuri e urodeli · rane, rospi, tritoni e salamandre', 7010, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (801, 'Pesci ornamentali', 'Acqua dolce tropicale', 8010, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (802, 'Pesci ornamentali', 'Acqua fredda', 8020, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (803, 'Pesci ornamentali', 'Marini e di barriera', 8030, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (901, 'Invertebrati', 'Invertebrati terrestri e acquatici da compagnia', 9010, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (1001, 'Equidi', 'Cavalli, pony e asini da compagnia', 10010, 1795273407, 1795273407);
INSERT INTO `petbreed` (`id`, `category`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (1101, 'Altri pet', 'Altri animali da compagnia consentiti', 11010, 1795273407, 1795273407);

-- pettype: 10 record
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (1, 'Docile', 10, 1794866628, 1795273407);
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (2, 'Aggressivo con persone', 20, 1794866628, 1795273407);
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (3, 'Aggressivo con pet', 30, 1794866628, 1795273407);
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (4, 'Ansioso', 40, 1794866628, 1795273407);
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (5, 'Iperattivo', 50, 1794866628, 1795273407);
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (6, 'Anziano', 60, 1794866628, 1795273407);
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (7, 'Cucciolo', 70, 1794866628, 1795273407);
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (8, 'Con esigenze speciali', 80, 1794866628, 1795273407);
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (9, 'Qualsiasi', 0, 1794866628, 1795273407);
INSERT INTO `pettype` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (10, 'Malato', 90, 1795273407, 1795273407);

-- housefeature: 8 record
INSERT INTO `housefeature` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (1, 'Giardino (recintato SI/NO)', 10, 1794866628, 1795273407);
INSERT INTO `housefeature` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (2, 'Appartamento', 20, 1794866628, 1795273407);
INSERT INTO `housefeature` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (3, 'Casa indipendente', 30, 1794866628, 1795273407);
INSERT INTO `housefeature` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (4, 'Villa', 40, 1794866628, 1795273407);
INSERT INTO `housefeature` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (5, 'Terrazzo (piccolo medio grande)', 50, 1794866628, 1795273407);
INSERT INTO `housefeature` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (6, 'Confinamento (zona dedicata, cuccia interna/esterna, intera casa)', 60, 1794866628, 1795273407);
INSERT INTO `housefeature` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (7, 'Presenza altri animali', 70, 1794866628, 1795273407);
INSERT INTO `housefeature` (`id`, `name`, `sortorder`, `created_at`, `updated_at`) VALUES (8, 'Presenza ascensore', 80, 1794866628, 1795273407);

-- servicefeature: 7 record
INSERT INTO `servicefeature` (`id`, `name`, `created_at`, `updated_at`) VALUES (1, 'Tracking GPS', 1794866628, 1795273407);
INSERT INTO `servicefeature` (`id`, `name`, `created_at`, `updated_at`) VALUES (2, 'Chat privata', 1794866628, 1795273407);
INSERT INTO `servicefeature` (`id`, `name`, `created_at`, `updated_at`) VALUES (3, 'Note fine servizio', 1794866628, 1795273407);
INSERT INTO `servicefeature` (`id`, `name`, `created_at`, `updated_at`) VALUES (4, 'Invio foto/video', 1794866628, 1795273407);
INSERT INTO `servicefeature` (`id`, `name`, `created_at`, `updated_at`) VALUES (5, 'Incontro preventivo', 1794866628, 1795273407);
INSERT INTO `servicefeature` (`id`, `name`, `created_at`, `updated_at`) VALUES (6, 'Urgenza', 1794866628, 1795273407);
INSERT INTO `servicefeature` (`id`, `name`, `created_at`, `updated_at`) VALUES (7, 'Periodico', 1794866628, 1795273407);

-- service: 6 record
INSERT INTO `service` (`id`, `name`, `description`, `requires_home_photo`, `created_at`, `updated_at`) VALUES (1, 'Passeggiata', 'Passeggiate personalizzate per il tuo pet, con attenzione ai ritmi, al benessere e alle abitudini quotidiane.', 0, 1794866628, 1795273407);
INSERT INTO `service` (`id`, `name`, `description`, `requires_home_photo`, `created_at`, `updated_at`) VALUES (2, 'Soggiorno a domicilio', 'Assistenza direttamente a casa del cliente per garantire continuita, serenita e cura nell\'ambiente abituale del pet.', 0, 1794866628, 1795273407);
INSERT INTO `service` (`id`, `name`, `description`, `requires_home_photo`, `created_at`, `updated_at`) VALUES (3, 'Soggiorno presso il petassistant', 'Ospitalita in ambiente accogliente e controllato presso il petassistant, con presenza costante e cura dedicata.', 1, 1794866628, 1795273407);
INSERT INTO `service` (`id`, `name`, `description`, `requires_home_photo`, `created_at`, `updated_at`) VALUES (4, 'Asilo diurno', 'Accoglienza giornaliera con momenti di gioco, relax e attenzione continua, ideale per assenze durante la giornata.', 0, 1794866628, 1795273407);
INSERT INTO `service` (`id`, `name`, `description`, `requires_home_photo`, `created_at`, `updated_at`) VALUES (5, 'Pet Taxi', 'Trasporto organizzato e affidabile verso veterinari, toelettatori o appuntamenti dedicati alla salute e al benessere del pet.', 0, 1794866628, 1795273407);
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
