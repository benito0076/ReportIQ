ALTER TABLE "reports" ADD COLUMN "estado" varchar(12) DEFAULT 'borrador' NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "enviado_by" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "enviado_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "revisado_by" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "revisado_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "observaciones" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "aprobado_key" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "aprobado_nombre" varchar(255);--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_enviado_by_users_id_fk" FOREIGN KEY ("enviado_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_revisado_by_users_id_fk" FOREIGN KEY ("revisado_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_estado_idx" ON "reports" USING btree ("estado");