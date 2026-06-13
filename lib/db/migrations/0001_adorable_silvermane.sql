ALTER TABLE "chatbot"."Chat" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chatbot"."ProjectFile" ADD COLUMN "chatId" uuid;--> statement-breakpoint
ALTER TABLE "chatbot"."ProjectFile" ADD CONSTRAINT "ProjectFile_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "chatbot"."Chat"("id") ON DELETE set null ON UPDATE no action;