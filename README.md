# 🎯 Capacitaciones Interactivas

Plataforma de capacitaciones interactivas tipo Kahoot/Mentimeter, construida con Next.js 14, TypeScript, Tailwind CSS y Supabase.

## Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage)
- **Deploy**: Vercel

## Setup

### 1. Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) y crear un nuevo proyecto
2. En el **SQL Editor**, ejecutar todo el contenido de `supabase-migration.sql`
3. Copiar la **Project URL** y la **anon public key** desde Settings → API

### 2. Variables de entorno

Crear `.env.local` (copiar de `.env.local.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Instalar y correr

```bash
npm install
npm run dev
```

## Deploy en Vercel

1. Crear repositorio en GitHub y subir el código
2. Conectar en [vercel.com](https://vercel.com) → New Project
3. Agregar las variables de entorno **sin marcarlas como Sensitive**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy automático en cada push a main

## Estructura de rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Pantalla inicio: código + botón capacitador |
| `/admin` | Login capacitador (Supabase Auth) |
| `/admin/dashboard` | Lista de eventos del capacitador |
| `/admin/eventos/[id]` | Panel de gestión del evento |
| `/evento/[id]` | Registro asistente |
| `/evento/[id]/juego` | Pantalla del asistente durante el juego |
| `/proyector/[id]` | Pantalla proyector (modo oscuro) |

## Cómo usar

### Como Capacitador:
1. Ir a `/admin` y hacer login con email/password de Supabase Auth
2. Crear un nuevo evento desde el dashboard
3. Agregar preguntas (V/F o múltiple opción) con imágenes opcionales
4. Abrir el proyector en pantalla grande
5. Activar preguntas una a una desde el panel
6. Cerrar cada pregunta para mostrar resultados
7. Finalizar para mostrar el podio
8. Sortear ganadores desde la pestaña "Sorteo"

### Como Asistente:
1. Escanear el QR en el proyector o ingresar el código de 4 dígitos
2. Completar el formulario de registro
3. Responder las preguntas con el timer visible
4. Ver si fue correcto/incorrecto después de cada cierre
5. Ver el podio final automáticamente

## Sincronización

El sistema usa **polling cada 2 segundos** (sin Supabase Realtime) para sincronizar:
- Pregunta activa → aparece en celulares
- Pregunta cerrada → muestra resultado correcto/incorrecto
- Evento finalizado → muestra podio en celulares y proyector

## Sistema de puntos

- Máximo: 1000 puntos por respuesta correcta
- Mínimo: 100 puntos por respuesta correcta al final del tiempo
- Los puntos disminuyen linealmente con el tiempo de respuesta
- Respuestas incorrectas: 0 puntos
