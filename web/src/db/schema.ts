import { sql } from "drizzle-orm";
import {
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
import type { Direccion, Esquema, ReportKind, UserRole } from "./enums";
import type { ResultadosProyecto } from "@/lib/engine-types";

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
    cliente: varchar("cliente", { length: 255 }).notNull().default(""),
    codigoInforme: varchar("codigo_informe", { length: 100 }).notNull().default(""),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    /** Últimos resultados devueltos por el motor (se invalidan al modificar datos). */
    resultados: jsonb("resultados").$type<ResultadosProyecto>(),
    /** Archivo de la estación meteorológica (capítulo de meteorología del informe). */
    meteoKey: text("meteo_key"),
    meteoNombre: varchar("meteo_nombre", { length: 255 }),
    procesadoAt: timestamp("procesado_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("projects_updated_idx").on(t.updatedAt)],
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
  plantillaKey: text("plantilla_key"),
  plantillaNombre: varchar("plantilla_nombre", { length: 255 }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Project = typeof projects.$inferSelect;
export type Point = typeof points.$inferSelect;
export type MemoryFile = typeof memoryFiles.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type User = typeof users.$inferSelect;
