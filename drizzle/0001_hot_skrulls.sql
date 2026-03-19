ALTER TABLE "files" ALTER COLUMN "blob_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "ui_message_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "parts" jsonb;--> statement-breakpoint
UPDATE "messages"
SET "ui_message_id" = "id"::text
WHERE "ui_message_id" IS NULL;--> statement-breakpoint
UPDATE "messages"
SET "parts" = jsonb_build_array(jsonb_build_object('type', 'text', 'text', "content"))
WHERE "parts" IS NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "ui_message_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "parts" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_ui_message_id_idx" ON "messages" USING btree ("ui_message_id");
