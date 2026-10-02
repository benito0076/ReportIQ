CREATE TABLE "water_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"orden" integer NOT NULL,
	"nombre" varchar(150) NOT NULL,
	"hoja_fp" varchar(60) DEFAULT '' NOT NULL,
	"evaluar" boolean DEFAULT true NOT NULL,
	"tipo_agua" varchar(10) DEFAULT 'ARnD' NOT NULL,
	"longitud" varchar(50) DEFAULT '' NOT NULL,
	"latitud" varchar(50) DEFAULT '' NOT NULL,
	"descripcion" text DEFAULT '' NOT NULL,
	"informe_key" text,
	"informe_nombre" varchar(255),
	"foto_key" text,
	"foto_nombre" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "vertimiento" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "fp004_key" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "fp004_nombre" varchar(255);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "resultados_vertimiento" jsonb;--> statement-breakpoint
ALTER TABLE "water_points" ADD CONSTRAINT "water_points_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "water_points_project_idx" ON "water_points" USING btree ("project_id","orden");--> statement-breakpoint
-- Igual que las demás tablas (0001_enable_rls): la app entra con el rol propietario.
ALTER TABLE "water_points" ENABLE ROW LEVEL SECURITY;