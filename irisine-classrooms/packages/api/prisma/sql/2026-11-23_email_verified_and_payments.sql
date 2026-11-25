-- Additive only. Safe to re-run (IF NOT EXISTS). No DROP, no data change.
-- Existing users get emailVerified = true, so nobody is locked out.

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `emailVerified` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS `email_otps` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(191) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `email_otps_email_purpose_createdAt_idx`(`email`, `purpose`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_orders` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `feeHeadId` VARCHAR(191) NOT NULL,
    `initiatedBy` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `status` VARCHAR(191) NOT NULL DEFAULT 'CREATED',
    `razorpayOrderId` VARCHAR(191) NOT NULL,
    `razorpayPaymentId` VARCHAR(191) NULL,
    `method` VARCHAR(191) NULL,
    `failureReason` VARCHAR(191) NULL,
    `receiptNo` VARCHAR(191) NULL,
    `paymentId` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `payment_orders_razorpayOrderId_key`(`razorpayOrderId`),
    UNIQUE INDEX `payment_orders_razorpayPaymentId_key`(`razorpayPaymentId`),
    UNIQUE INDEX `payment_orders_receiptNo_key`(`receiptNo`),
    INDEX `payment_orders_studentId_idx`(`studentId`),
    INDEX `payment_orders_initiatedBy_idx`(`initiatedBy`),
    INDEX `payment_orders_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_webhook_events` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `processedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `payment_webhook_events_eventId_key`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
