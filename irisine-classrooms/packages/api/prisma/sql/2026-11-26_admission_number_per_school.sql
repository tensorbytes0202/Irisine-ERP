-- Admission numbers become unique per school instead of across the whole platform.
-- Run this on the database BEFORE deploying the code that goes with it. The old code keeps
-- working after these statements. No table is dropped and no row is deleted.
-- Run the statements one at a time. For TiDB first select the database: USE irisine;

-- 1. New column on students.
ALTER TABLE `students` ADD COLUMN `schoolId` VARCHAR(191) NULL;

-- 2. Fill it from each student's user account. Safe to run again: run it once more after the deploy,
--    so students added in between get their school too.
UPDATE `students` s JOIN `users` u ON u.`id` = s.`userId` SET s.`schoolId` = u.`schoolId` WHERE s.`schoolId` IS NULL;

-- 3. New rule: an admission number is unique inside one school.
CREATE UNIQUE INDEX `students_schoolId_admissionNo_key` ON `students`(`schoolId`, `admissionNo`);

-- 4. Remove the old rule (an index only, the data stays).
DROP INDEX `students_admissionNo_key` ON `students`;

-- Check: both numbers must be 0 and the second query must list students_schoolId_admissionNo_key.
-- SELECT COUNT(*) FROM `students` WHERE `schoolId` IS NULL;
-- SHOW INDEX FROM `students`;
