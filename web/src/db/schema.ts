import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type {
  ActivityEvent,
  CondicionBarrido,
  Direccion,
  Esquema,
  PlantillaAire,
  ProjectType,
  ReportKind,
  UserRole,
} from "./enums";
import type { ResultadosAire, ResultadosProyecto } from "@/lib/engine-types";
import type { DatosInforme } from "@/lib/validation";

export type { UserRole };

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 20 }).$type<UserRole>().notNull().default("user"),
  ...timestamps,
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: varchar("nombre", { length: 255 }).notNull(),
    /** "ambiental" o "emision"; se elige al crear el proyecto. */
    tipo: varchar("tipo", { length: 12 }).$type<ProjectType>().notNull().default("ambiental"),
    cliente: varchar("cliente", { length: 255 }).notNull().default(""),
    codigoInforme: varchar("codigo_informe", { length: 100 }).notNull().default(""),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    /** Últimos resultados devueltos por el motor (se invalidan al modificar datos). */
    resultados: jsonb("resultados").$type<ResultadosProyecto>(),
    /** Archivo de la estación meteorológica (capítulo de meteorología del informe). */
    meteoKey: text("meteo_key"),
    meteoNombre: varchar("meteo_nombre", { length: 255 }),
    /** Datos para redactar el informe Word (área de estudio, portada, cliente…). */
    informe: jsonb("informe").$type<Partial<DatosInforme>>().notNull().default(sql`'{}'::jsonb`),
    procesadoAt: timestamp("procesado_at", { withTimezone: true }),
    /** Resultados de calidad del aire (tipo "aire"; se invalidan al cambiar estaciones o plantillas). */
    resultadosAire: jsonb("resultados_aire").$type<ResultadosAire>(),
    ...timestamps,
  },
  (t) => [index("projects_updated_idx").on(t.updatedAt)],
);

/** Estación de monitoreo de calidad del aire: el número es la hoja CA-n / ESTACION n de las plantillas. */
export const airStations = pgTable(
  "air_stations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    nombre: varchar("nombre", { length: 150 }).notNull().default(""),
    codigo: varchar("codigo", { length: 60 }).notNull().default(""),
    codigoAnla: varchar("codigo_anla", { length: 60 }).notNull().default(""),
    longitud: varchar("longitud", { length: 50 }).notNull().default(""),
    latitud: varchar("latitud", { length: 50 }).notNull().default(""),
    descripcion: text("descripcion").notNull().default(""),
    ...timestamps,
  },
  (t) => [uniqueIndex("air_stations_numero_uq").on(t.projectId, t.numero)],
);

/** Plantilla FP diligenciada de un proyecto de calidad del aire (una por contaminante). */
export const airFiles = pgTable(
  "air_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    plantilla: varchar("plantilla", { length: 12 }).$type<PlantillaAire>().notNull(),
    fileKey: text("file_key").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    size: integer("size").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("air_files_plantilla_uq").on(t.projectId, t.plantilla)],
);

export const points = pgTable(
  "points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    orden: integer("orden").notNull(),
    nombre: varchar("nombre", { length: 100 }).notNull(),
    sector: text("sector").notNull().default(""),
    incertidumbre: doublePrecision("incertidumbre").notNull().default(0),
    este: varchar("este", { length: 50 }).notNull().default(""),
    norte: varchar("norte", { length: 50 }).notNull().default(""),
    altitud: varchar("altitud", { length: 50 }).notNull().default(""),
    descripcion: text("descripcion").notNull().default(""),
    /** Fuentes de ruido percibidas (capítulo «Descripción de las fuentes» del informe). */
    fuentes: text("fuentes").notNull().default(""),
    fotoKey: text("foto_key"),
    fotoNombre: varchar("foto_nombre", { length: 255 }),
    ...timestamps,
  },
  (t) => [index("points_project_idx").on(t.projectId, t.orden)],
);

/** Memoria del sonómetro (.xlsx) asignada a un punto / esquema / dirección. */
export const memoryFiles = pgTable(
  "memory_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pointId: uuid("point_id")
      .notNull()
      .references(() => points.id, { onDelete: "cascade" }),
    esquema: varchar("esquema", { length: 4 }).$type<Esquema>().notNull(),
    direccion: varchar("direccion", { length: 10 }).$type<Direccion>().notNull(),
    fileKey: text("file_key").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    size: integer("size").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("memory_files_slot_uq").on(t.pointId, t.esquema, t.direccion)],
);

/** Memorias de 2 minutos del barrido perimetral (proyectos de emisión). */
export const barridoFiles = pgTable(
  "barrido_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    nombre: varchar("nombre", { length: 100 }).notNull(),
    condicion: varchar("condicion", { length: 10 }).$type<CondicionBarrido>().notNull().default("Encendido"),
    /** Barrido elegido como punto de medición (se sombrea en la tabla del informe). */
    seleccionado: boolean("seleccionado").notNull().default(false),
    fileKey: text("file_key").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    size: integer("size").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("barrido_files_project_idx").on(t.projectId)],
);

/** Informes / entregables generados (historial descargable). */
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 10 }).$type<ReportKind>().notNull(),
    fileKey: text("file_key").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    size: integer("size").notNull(),
    advertencias: jsonb("advertencias").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reports_project_idx").on(t.projectId, t.createdAt)],
);

/** Inventario de sonómetros (búsqueda por número de serie). */
export const equipment = pgTable("equipment", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  codigo: varchar("codigo", { length: 50 }).notNull().default(""),
  serial: varchar("serial", { length: 100 }).notNull(),
  ...timestamps,
});

/** Ajustes generales (una sola fila, id = 1). */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  elaboradoPor: varchar("elaborado_por", { length: 255 }).notNull().default(""),
  /** Firmas del cuadro de control del informe. */
  elaboroNombre: varchar("elaboro_nombre", { length: 255 }).notNull().default(""),
  elaboroCargo: varchar("elaboro_cargo", { length: 255 }).notNull().default(""),
  autorizoNombre: varchar("autorizo_nombre", { length: 255 }).notNull().default(""),
  autorizoCargo: varchar("autorizo_cargo", { length: 255 }).notNull().default(""),
  plantillaKey: text("plantilla_key"),
  plantillaNombre: varchar("plantilla_nombre", { length: 255 }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Registro de actividad: inicios de sesión y acciones importantes (se conserva 12 meses). */
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Correo en el momento del evento (o el intentado, en un inicio fallido). */
    email: varchar("email", { length: 255 }).notNull().default(""),
    event: varchar("event", { length: 40 }).$type<ActivityEvent>().notNull(),
    detail: text("detail").notNull().default(""),
    ip: varchar("ip", { length: 64 }).notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
  },
  (t) => [index("activity_log_created_idx").on(t.createdAt), index("activity_log_user_idx").on(t.userId)],
);

export type Project = typeof projects.$inferSelect;
export type Point = typeof points.$inferSelect;
export type MemoryFile = typeof memoryFiles.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type BarridoFile = typeof barridoFiles.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type User = typeof users.$inferSelect;
export type AirStation = typeof airStations.$inferSelect;
export type AirFile = typeof airFiles.$inferSelect;
