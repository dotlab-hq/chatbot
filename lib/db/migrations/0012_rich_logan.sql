ALTER TABLE "chatbot"."Skill" ADD COLUMN "upload_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "chatbot"."Skill" ADD COLUMN "upload_error" text;