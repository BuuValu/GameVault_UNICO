-- GAMEVAULT - Corte 2: modelo SQL en ingles, con restricciones CHECK
-- Basado en el SQL del equipo. MySQL 8.0.16 o superior.
-- IMPORTANTE: CREATE TABLE IF NOT EXISTS no modifica tablas existentes.
-- Para usar este script en una base ya creada, aplicar una migracion por separado.

-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema mydb
-- -----------------------------------------------------
-- -----------------------------------------------------
-- Schema gamevault
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema gamevault
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `gamevault` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ;
USE `gamevault` ;

-- -----------------------------------------------------
-- Table `gamevault`.`video_games`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `gamevault`.`video_games` (
  `video_game_id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `image_url` VARCHAR(500) NULL DEFAULT NULL,
  `description` TEXT NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `age_rating` VARCHAR(20) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT '1',
  CONSTRAINT `chk_video_game_price` CHECK (`price` >= 0),
  PRIMARY KEY (`video_game_id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Table `gamevault`.`achievements`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `gamevault`.`achievements` (
  `achievement_id` INT NOT NULL AUTO_INCREMENT,
  `video_game_id` INT NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` TEXT NOT NULL,
  `type` ENUM('simple', 'progress', 'date') NOT NULL DEFAULT 'simple',
  `target` INT NULL DEFAULT NULL,
  CONSTRAINT `chk_achievement_target` CHECK (`target` IS NULL OR `target` > 0),
  PRIMARY KEY (`achievement_id`),
  UNIQUE INDEX `uq_achievement_name_video_game` (`video_game_id` ASC, `name` ASC) VISIBLE,
  CONSTRAINT `fk_achievement_video_game`
    FOREIGN KEY (`video_game_id`)
    REFERENCES `gamevault`.`video_games` (`video_game_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Table `gamevault`.`users`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `gamevault`.`users` (
  `user_id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `password` VARCHAR(255) NOT NULL COMMENT 'Plaintext only for academic Cut 2; not for production',
  `accepted_terms` TINYINT(1) NOT NULL DEFAULT '0',
  `role` ENUM('user', 'administrator') NOT NULL DEFAULT 'user',
  `registration_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE INDEX `email` (`email` ASC) VISIBLE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Table `gamevault`.`achievement_progress`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `gamevault`.`achievement_progress` (
  `user_id` INT NOT NULL,
  `achievement_id` INT NOT NULL,
  `progress` INT NOT NULL DEFAULT '0',
  `is_unlocked` TINYINT(1) NOT NULL DEFAULT '0',
  `unlock_date` DATETIME NULL DEFAULT NULL,
  CONSTRAINT `chk_progress_nonnegative` CHECK (`progress` >= 0),
  CONSTRAINT `chk_unlock_date` CHECK (((`is_unlocked` = 0 AND `unlock_date` IS NULL) OR (`is_unlocked` = 1 AND `unlock_date` IS NOT NULL))),
  PRIMARY KEY (`user_id`, `achievement_id`),
  INDEX `fk_ap_achievement` (`achievement_id` ASC) VISIBLE,
  CONSTRAINT `fk_ap_achievement`
    FOREIGN KEY (`achievement_id`)
    REFERENCES `gamevault`.`achievements` (`achievement_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_ap_user`
    FOREIGN KEY (`user_id`)
    REFERENCES `gamevault`.`users` (`user_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Table `gamevault`.`genres`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `gamevault`.`genres` (
  `genre_id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(60) NOT NULL,
  PRIMARY KEY (`genre_id`),
  UNIQUE INDEX `name` (`name` ASC) VISIBLE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Table `gamevault`.`purchases`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `gamevault`.`purchases` (
  `purchase_id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `video_game_id` INT NOT NULL,
  `purchase_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `price_paid` DECIMAL(10,2) NOT NULL,
  `status` ENUM('pending', 'confirmed', 'failed') NOT NULL DEFAULT 'pending',
  CONSTRAINT `chk_purchase_price` CHECK (`price_paid` >= 0),
  PRIMARY KEY (`purchase_id`),
  UNIQUE INDEX `uq_purchase_user_video_game` (`user_id` ASC, `video_game_id` ASC) VISIBLE,
  INDEX `fk_purchase_video_game` (`video_game_id` ASC) VISIBLE,
  CONSTRAINT `fk_purchase_user`
    FOREIGN KEY (`user_id`)
    REFERENCES `gamevault`.`users` (`user_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_video_game`
    FOREIGN KEY (`video_game_id`)
    REFERENCES `gamevault`.`video_games` (`video_game_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Table `gamevault`.`reviews`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `gamevault`.`reviews` (
  `review_id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `video_game_id` INT NOT NULL,
  `rating` TINYINT NOT NULL,
  `comment` TEXT NULL DEFAULT NULL,
  `hours_played` DECIMAL(7,2) NULL DEFAULT NULL,
  `review_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `chk_review_rating` CHECK (`rating` BETWEEN 1 AND 5),
  CONSTRAINT `chk_review_hours` CHECK (`hours_played` IS NULL OR `hours_played` >= 0),
  PRIMARY KEY (`review_id`),
  UNIQUE INDEX `uq_review_user_video_game` (`user_id` ASC, `video_game_id` ASC) VISIBLE,
  CONSTRAINT `fk_review_purchase`
    FOREIGN KEY (`user_id` , `video_game_id`)
    REFERENCES `gamevault`.`purchases` (`user_id` , `video_game_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Table `gamevault`.`tags`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `gamevault`.`tags` (
  `tag_id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`tag_id`),
  UNIQUE INDEX `name` (`name` ASC) VISIBLE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Table `gamevault`.`review_tags`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `gamevault`.`review_tags` (
  `review_id` INT NOT NULL,
  `tag_id` INT NOT NULL,
  PRIMARY KEY (`review_id`, `tag_id`),
  INDEX `fk_rt_tag` (`tag_id` ASC) VISIBLE,
  CONSTRAINT `fk_rt_review`
    FOREIGN KEY (`review_id`)
    REFERENCES `gamevault`.`reviews` (`review_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_rt_tag`
    FOREIGN KEY (`tag_id`)
    REFERENCES `gamevault`.`tags` (`tag_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Table `gamevault`.`video_game_genres`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `gamevault`.`video_game_genres` (
  `video_game_id` INT NOT NULL,
  `genre_id` INT NOT NULL,
  PRIMARY KEY (`video_game_id`, `genre_id`),
  INDEX `fk_vgg_genre` (`genre_id` ASC) VISIBLE,
  CONSTRAINT `fk_vgg_genre`
    FOREIGN KEY (`genre_id`)
    REFERENCES `gamevault`.`genres` (`genre_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_vgg_video_game`
    FOREIGN KEY (`video_game_id`)
    REFERENCES `gamevault`.`video_games` (`video_game_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
