CREATE TABLE "barrido_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"condicion" varchar(10) DEFAULT 'Encendido' NOT NULL,
	"seleccionado" boolean DEFAULT false NOT NULL,
	"file_key" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"size" integer NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "tipo" varchar(12) DEFAULT 'ambiental' NOT NULL;--> statement-breakpoint
ALTER TABLE "barrido_files" ADD CONSTRAINT "barrido_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "barrido_files_project_idx" ON "barrido_files" USING btree ("project_id");--> statement-breakpoint
-- Igual que las demás tablas (0001_enable_rls): la app entra con el rol propietario.
ALTER TABLE "barrido_files" ENABLE ROW LEVEL SECURITY;