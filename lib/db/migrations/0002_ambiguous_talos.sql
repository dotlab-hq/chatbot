CREATE TABLE "chatbot"."Personalization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"theme" varchar DEFAULT 'modern' NOT NULL,
	"font" varchar DEFAULT 'sora' NOT NULL,
	"font_size" varchar DEFAULT 'm' NOT NULL,
	"spacing" varchar DEFAULT 'cozy' NOT NULL,
	"show_avatars" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Personalization_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
ALTER TABLE "chatbot"."Personalization" ADD CONSTRAINT "Personalization_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "chatbot"."user"("id") ON DELETE no action ON UPDATE no action;