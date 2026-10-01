CREATE TABLE "air_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"plantilla" varchar(12) NOT NULL,
	"file_key" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"size" integer NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "air_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"nombre" varchar(150) DEFAULT '' NOT NULL,
	"codigo" varchar(60) DEFAULT '' NOT NULL,
	"codigo_anla" varchar(60) DEFAULT '' NOT NULL,
	"longitud" varchar(50) DEFAULT '' NOT NULL,
	"latitud" varchar(50) DEFAULT '' NOT NULL,
	"descripcion" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "resultados_aire" jsonb;--> statement-breakpoint
ALTER TABLE "air_files" ADD CONSTRAINT "air_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "air_stations" ADD CONSTRAINT "air_stations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "air_files_plantilla_uq" ON "air_files" USING btree ("project_id","plantilla");--> statement-breakpoint
CREATE UNIQUE INDEX "air_stations_numero_uq" ON "air_stations" USING btree ("project_id","numero");--> statement-breakpoint
-- Igual que las demás tablas (0001_enable_rls): la app entra con el rol propietario.
ALTER TABLE "air_stations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "air_files" ENABLE ROW LEVEL SECURITY;
