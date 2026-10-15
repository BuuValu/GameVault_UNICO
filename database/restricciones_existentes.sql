-- GAMEVAULT - migracion no destructiva para el esquema EN INGLES existente
-- Ejecutar SOLO si ya se creo gamevault con SQLScript.sql original.
-- MySQL 8.0.16+; revisar datos previos que pudieran violar CHECK.
-- IMPORTANTE: no es idempotente: no ejecutar dos veces.
USE `gamevault`;

ALTER TABLE `gamevault`.`video_games` ADD CONSTRAINT `chk_video_game_price` CHECK (`price` >= 0);
ALTER TABLE `gamevault`.`purchases` ADD CONSTRAINT `chk_purchase_price` CHECK (`price_paid` >= 0);
ALTER TABLE `gamevault`.`reviews` ADD CONSTRAINT `chk_review_rating` CHECK (`rating` BETWEEN 1 AND 5);
ALTER TABLE `gamevault`.`reviews` ADD CONSTRAINT `chk_review_hours` CHECK (`hours_played` IS NULL OR `hours_played` >= 0);
ALTER TABLE `gamevault`.`achievements` ADD CONSTRAINT `chk_achievement_target` CHECK (`target` IS NULL OR `target` > 0);
ALTER TABLE `gamevault`.`achievement_progress` ADD CONSTRAINT `chk_progress_nonnegative` CHECK (`progress` >= 0);
ALTER TABLE `gamevault`.`achievement_progress` ADD CONSTRAINT `chk_unlock_date` CHECK (((`is_unlocked` = 0 AND `unlock_date` IS NULL) OR (`is_unlocked` = 1 AND `unlock_date` IS NOT NULL)));
