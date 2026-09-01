# Planeador RAG — Colegio Bilingüe San José Campestre

Sistema institucional de generación de documentos mediante RAG (Retrieval-Augmented Generation) para el **Colegio Bilingüe San José Campestre**.

## ✦ Características

- **RAG preciso**: Documentos generados a partir de los lineamientos institucionales reales del colegio
- **5 tipos de documentos**: Planeador de clase, Plan de área, Informe académico, Circular institucional, Proyecto pedagógico
- **3 formatos de exportación**: PDF, Word (.docx), Google Docs (enlace editable)
- **Bilingüe**: Generación en Español o English
- **Base de conocimiento categorizada**: Por nivel (primaria/secundaria/bachillerato) y área
- **Autenticación institucional**: Google OAuth con cuentas del colegio
- **Historial completo**: Todos los documentos generados quedan guardados por usuario
- **Vista previa editable**: Editor rich-text antes de exportar

## 🛠 Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| UI | Tailwind CSS v4 + shadcn/ui + lucide-react |
| Auth | Supabase Auth (Google OAuth) |
| Base de datos | Supabase PostgreSQL + pgvector |
| Storage | Supabase Storage |
| Embeddings | Google AI Studio — `text-embedding-004` |
| Generación | Google AI Studio — `gemini-2.0-flash` |
| PDF | @react-pdf/renderer |
| Word | docx (npm) |
| Google Docs | Google Drive API |
| Deploy | Vercel |

## 🚀 Setup local

### 1. Clonar e instalar dependencias
```bash
git clone https://github.com/TU_ORG/cbsjc-planeador-rag.git
cd cbsjc-planeador-rag
npm install
```

### 2. Variables de entorno
```bash
cp .env.example .env.local
```
Llenar `.env.local` con:
- `NEXT_PUBLIC_SUPABASE_URL` — URL del proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Anon key de Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (solo servidor)
- `GOOGLE_AI_API_KEY` — API key de Google AI Studio
- `GOOGLE_SERVICE_ACCOUNT_JSON` — JSON de service account (para Google Docs)
- `NEXT_PUBLIC_APP_URL` — URL del app (http://localhost:3000 en desarrollo)

### 3. Configurar Supabase

**Base de datos:**
```bash
# Ejecutar las migraciones en el SQL Editor de Supabase Dashboard
# Archivo: supabase/migrations/001_initial.sql
```

**Storage buckets** (crear en Supabase Dashboard → Storage):
- `source-documents` — Privado — Para PDFs rectores subidos
- `generated-exports` — Privado — Para PDFs/DOCX generados

**Auth** (Supabase Dashboard → Authentication → Providers):
- Activar Google provider
- Agregar Client ID y Client Secret de Google Cloud Console
- Redirect URI: `https://TU_PROYECTO.supabase.co/auth/v1/callback`

### 4. Correr en desarrollo
```bash
npm run dev
```

## 📋 Configuración de Supabase (detallada)

### pgvector
La extensión `vector` se habilita automáticamente con la migración SQL.

### RLS (Row Level Security)
Las políticas de seguridad están incluidas en la migración. Los documentos rectores son **compartidos** (todos los usuarios autenticados pueden leer), mientras que los documentos generados son **privados** (solo el usuario propietario).

### Google Docs (opcional)
Para exportar a Google Docs se necesita:
1. Crear un proyecto en Google Cloud Console
2. Activar Google Docs API y Google Drive API
3. Crear una cuenta de servicio y descargar el JSON de credenciales
4. Pegar el contenido del JSON en `GOOGLE_SERVICE_ACCOUNT_JSON`

## 🔧 Comandos útiles

```bash
npm run dev          # Desarrollo local
npm run build        # Build de producción
npm run type-check   # Verificar tipos TypeScript
npm run lint         # Lint con ESLint
```

## 📁 Estructura del proyecto

```
├── app/
│   ├── (auth)/login/         # Página de login
│   ├── (dashboard)/          # Páginas protegidas
│   │   ├── dashboard/        # Panel principal
│   │   ├── upload/           # Subir documentos rectores
│   │   ├── generate/         # Generar documentos
│   │   ├── preview/[id]/     # Vista previa editable
│   │   └── history/          # Historial
│   ├── api/                  # Route handlers
│   │   ├── embed/            # Pipeline de embeddings
│   │   ├── generate/         # Generación RAG
│   │   ├── export/           # Exportación PDF/DOCX/GDocs
│   │   └── documents/        # CRUD documentos rectores
│   └── auth/callback/        # OAuth callback
├── components/
│   ├── ui/                   # shadcn/ui components
│   └── scroll-to-top.tsx
├── lib/
│   ├── supabase/             # Clientes Supabase
│   ├── ai/                   # RAG pipeline
│   └── export/               # Exportación
├── types/                    # TypeScript types
├── supabase/migrations/      # SQL migrations
└── middleware.ts             # Protección de rutas
```

## 📝 TODO / Checklist de deploy

- [ ] Configurar variables de entorno en Vercel
- [ ] Ejecutar migración SQL en Supabase
- [ ] Crear buckets de Storage en Supabase
- [ ] Configurar Google OAuth en Supabase
- [ ] Configurar service account de Google Docs (opcional)
- [ ] Subir logo institucional a `public/logo.png`
- [ ] Verificar dominio personalizado en Vercel
- [ ] Smoke test: login → upload → generate → export
