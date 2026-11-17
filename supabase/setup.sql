-- Cartwise en Supabase: corre esto UNA vez en Supabase > SQL Editor.
--
-- Crea un esquema privado "cartwise" para las tablas de Django y un usuario de base de datos
-- (cartwise_app) que solo puede usar ese esquema. Supabase publica por su API automática las
-- tablas del esquema "public"; el esquema "cartwise" no está en esa lista, así que los datos
-- (incluidos los de salud) solo se pueden leer desde Django.
--
-- Cambia la contraseña antes de correrlo y guárdala para DATABASE_URL.

create schema if not exists cartwise;

create role cartwise_app with login password 'CAMBIA-ESTA-CLAVE';
grant usage, create on schema cartwise to cartwise_app;
alter default privileges in schema cartwise grant all on tables to cartwise_app;
alter default privileges in schema cartwise grant all on sequences to cartwise_app;

-- Django crea y usa sus tablas en "cartwise" sin configurar nada más
alter role cartwise_app set search_path = cartwise;

-- Por si acaso: que las llaves públicas de Supabase (anon, authenticated) no lleguen a este esquema
revoke all on schema cartwise from anon, authenticated;

-- DATABASE_URL para Render (usa el "Session pooler" de Supabase, que funciona con IPv4):
-- postgresql://cartwise_app.<ref-del-proyecto>:<clave>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
