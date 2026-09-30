CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"email" varchar(255) DEFAULT '' NOT NULL,
	"event" varchar(40) NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"ip" varchar(64) DEFAULT '' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_created_idx" ON "activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_log_user_idx" ON "activity_log" USING btree ("user_id");--> statement-breakpoint
-- Igual que las demás tablas (0001_enable_rls): la app entra con el rol propietario.
ALTER TABLE "activity_log" ENABLE ROW LEVEL SECURITY;