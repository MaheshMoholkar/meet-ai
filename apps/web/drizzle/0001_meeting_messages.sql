CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TABLE "meeting_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_messages" ADD CONSTRAINT "meeting_messages_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_messages_meeting_id_created_at_idx" ON "meeting_messages" USING btree ("meeting_id","created_at");