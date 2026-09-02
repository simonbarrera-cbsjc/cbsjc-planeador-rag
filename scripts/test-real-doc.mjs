import { createClient } from '@supabase/supabase-js'
import { generatePdf } from '../lib/export/pdf.js' // wait, pdf.tsx is typescript
import fs from 'fs'
import path from 'path'

const SUPABASE_URL = 'https://zbbvywffhfsfxjovnvrc.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiYnZ5d2ZmaGZzZnhqb3ZudnJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU2MTM2NiwiZXhwIjoyMDg4MTM3MzY2fQ.0c5BvS2b_1495lFm0k1pXq-Nf6c8d7e9f0a1b2c3d4e' // let's read from .env.local
