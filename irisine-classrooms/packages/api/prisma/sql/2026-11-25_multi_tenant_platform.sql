-- Multi-tenant platform foundation (2026-11-25).
-- ADDITIVE ONLY: no DROP, no TRUNCATE, no DELETE. Safe to re-run (IF NOT EXISTS / INSERT IGNORE).
-- Back up the database first. Apply AFTER 2026-11-23_email_verified_and_payments.sql.
--
-- Existing schools keep working: they are marked ACTIVE and are granted every module, exactly
-- as before. The platform owner can then trim each school's modules.

ALTER TABLE `schools`
  ADD COLUMN IF NOT EXISTS `city` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `state` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `country` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `website` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS `maxStudents` INTEGER NULL,
  ADD COLUMN IF NOT EXISTS `maxFaculty` INTEGER NULL;

CREATE TABLE IF NOT EXISTS `features` (
  `key` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `category` VARCHAR(191) NOT NULL DEFAULT 'GENERAL',
  `isCore` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `school_features` (
  `id` VARCHAR(191) NOT NULL,
  `schoolId` VARCHAR(191) NOT NULL,
  `featureKey` VARCHAR(191) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `adminManageable` BOOLEAN NOT NULL DEFAULT false,
  `adminEnabled` BOOLEAN NOT NULL DEFAULT true,
  `config` JSON NULL,
  `grantedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `school_features_schoolId_featureKey_key`(`schoolId`, `featureKey`),
  INDEX `school_features_schoolId_idx`(`schoolId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `account_invites` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `account_invites_tokenHash_key`(`tokenHash`),
  INDEX `account_invites_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `platform_admins` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `platform_admins_email_key`(`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Feature master list (the API keeps it in sync at startup too).
INSERT IGNORE INTO `features` (`key`, `name`, `category`, `isCore`, `isActive`, `createdAt`, `updatedAt`) VALUES
  ('CORE', 'Core (users, dashboard, settings)', 'CORE', 1, 1, NOW(3), NOW(3)),
  ('STUDENT_MANAGEMENT', 'Student Management', 'STUDENTS', 0, 1, NOW(3), NOW(3)),
  ('ADMISSION', 'Admissions', 'STUDENTS', 0, 1, NOW(3), NOW(3)),
  ('FACULTY_MANAGEMENT', 'Faculty Management', 'STAFF', 0, 1, NOW(3), NOW(3)),
  ('ATTENDANCE', 'Attendance', 'STUDENTS', 0, 1, NOW(3), NOW(3)),
  ('ACADEMICS', 'Academics (syllabus, timetable, homework)', 'ACADEMICS', 0, 1, NOW(3), NOW(3)),
  ('EXAMINATION', 'Examination and Results', 'ACADEMICS', 0, 1, NOW(3), NOW(3)),
  ('LMS', 'Learning Management (LMS)', 'ACADEMICS', 0, 1, NOW(3), NOW(3)),
  ('FEES', 'Fees Management', 'FINANCE', 0, 1, NOW(3), NOW(3)),
  ('EXPENSES_PAYROLL', 'Expenses and Payroll', 'FINANCE', 0, 1, NOW(3), NOW(3)),
  ('REPORTS', 'Reports and Analytics', 'ADMIN', 0, 1, NOW(3), NOW(3)),
  ('COMMUNICATION', 'Communication', 'COMMUNICATION', 0, 1, NOW(3), NOW(3)),
  ('EVENTS_CALENDAR', 'Events, Calendar and Gallery', 'COMMUNICATION', 0, 1, NOW(3), NOW(3)),
  ('LIBRARY', 'Library Management', 'CAMPUS', 0, 1, NOW(3), NOW(3)),
  ('TRANSPORT', 'Transport Management', 'CAMPUS', 0, 1, NOW(3), NOW(3)),
  ('HOSTEL', 'Hostel Management', 'CAMPUS', 0, 1, NOW(3), NOW(3)),
  ('INVENTORY_CAMPUS', 'Inventory, Visitors and Rooms', 'CAMPUS', 0, 1, NOW(3), NOW(3)),
  ('HEALTH_DISCIPLINE', 'Health and Discipline', 'STUDENTS', 0, 1, NOW(3), NOW(3)),
  ('HOBBY_CLUBS', 'Hobby and Clubs', 'ACADEMICS', 0, 1, NOW(3), NOW(3));

-- Backfill: every EXISTING school is granted every module, so nothing it uses today stops working.
-- adminManageable is false: school admins cannot switch modules until the platform owner allows it.
INSERT IGNORE INTO `school_features`
  (`id`, `schoolId`, `featureKey`, `enabled`, `adminManageable`, `adminEnabled`, `grantedBy`, `createdAt`, `updatedAt`)
SELECT UUID(), s.`id`, f.`key`, true, false, true, 'migration', NOW(3), NOW(3)
FROM `schools` s CROSS JOIN `features` f
WHERE f.`key` IN ('STUDENT_MANAGEMENT', 'ADMISSION', 'FACULTY_MANAGEMENT', 'ATTENDANCE', 'ACADEMICS', 'EXAMINATION', 'LMS', 'FEES', 'EXPENSES_PAYROLL', 'REPORTS', 'COMMUNICATION', 'EVENTS_CALENDAR', 'LIBRARY', 'TRANSPORT', 'HOSTEL', 'INVENTORY_CAMPUS', 'HEALTH_DISCIPLINE', 'HOBBY_CLUBS');
