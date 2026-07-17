ALTER TABLE "chatbot"."McpServer" ADD COLUMN "oauth_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chatbot"."McpServer" ADD COLUMN "oauth_tokens" json;--> statement-breakpoint
ALTER TABLE "chatbot"."McpServer" ADD COLUMN "oauth_client_information" json;--> statement-breakpoint
ALTER TABLE "chatbot"."McpServer" ADD COLUMN "oauth_code_verifier" text;--> statement-breakpoint
ALTER TABLE "chatbot"."McpServer" ADD COLUMN "oauth_state" text;