-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "savedModels" TEXT[] DEFAULT ARRAY[]::TEXT[];
