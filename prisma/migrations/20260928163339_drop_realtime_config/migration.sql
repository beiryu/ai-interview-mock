/*
  Warnings:

  - You are about to drop the column `realtimeModel` on the `user_configs` table. All the data in the column will be lost.
  - You are about to drop the column `realtimeVoice` on the `user_configs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user_configs" DROP COLUMN "realtimeModel",
DROP COLUMN "realtimeVoice";
