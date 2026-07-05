ALTER TABLE "chatbot"."Chat" ADD COLUMN "compaction_summary" text;--> statement-breakpoint
ALTER TABLE "chatbot"."Chat" ADD COLUMN "total_input_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "chatbot"."Chat" ADD COLUMN "total_output_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "chatbot"."Message_v2" ADD COLUMN "usage" json DEFAULT 'null'::json;