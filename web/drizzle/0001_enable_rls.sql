-- Supabase expone el esquema public por su API REST (PostgREST) a los roles
-- anon y authenticated. La aplicación no usa esa API: se conecta directo a
-- PostgreSQL con el rol propietario, que no está sujeto a RLS. Activar RLS
-- sin ninguna política bloquea todo acceso por la API pública.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "points" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "memory_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "equipment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
