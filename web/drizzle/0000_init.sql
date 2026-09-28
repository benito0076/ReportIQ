CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"codigo" varchar(50) DEFAULT '' NOT NULL,
	"serial" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"point_id" uuid NOT NULL,
	"esquema" varchar(4) NOT NULL,
	"direccion" varchar(10) NOT NULL,
	"file_key" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"size" integer NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"orden" integer NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"sector" text DEFAULT '' NOT NULL,
	"incertidumbre" double precision DEFAULT 0 NOT NULL,
	"este" varchar(50) DEFAULT '' NOT NULL,
	"norte" varchar(50) DEFAULT '' NOT NULL,
	"altitud" varchar(50) DEFAULT '' NOT NULL,
	"descripcion" text DEFAULT '' NOT NULL,
	"foto_key" text,
	"foto_nombre" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"cliente" varchar(255) DEFAULT '' NOT NULL,
	"codigo_informe" varchar(100) DEFAULT '' NOT NULL,
	"created_by" uuid,
	"resultados" jsonb,
	"procesado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" varchar(10) NOT NULL,
	"file_key" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"size" integer NOT NULL,
	"advertencias" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"elaborado_por" varchar(255) DEFAULT '' NOT NULL,
	"plantilla_key" text,
	"plantilla_nombre" varchar(255),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255),
	"password_hash" text NOT NULL,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "memory_files" ADD CONSTRAINT "memory_files_point_id_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points" ADD CONSTRAINT "points_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "memory_files_slot_uq" ON "memory_files" USING btree ("point_id","esquema","direccion");--> statement-breakpoint
CREATE INDEX "points_project_idx" ON "points" USING btree ("project_id","orden");--> statement-breakpoint
CREATE INDEX "projects_updated_idx" ON "projects" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "reports_project_idx" ON "reports" USING btree ("project_id","created_at");