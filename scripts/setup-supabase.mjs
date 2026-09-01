import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing Supabase credentials in environment')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  console.log('Testing connection to Supabase:', url)
  
  // 1. Create storage buckets if they don't exist
  console.log('Ensuring storage buckets exist...')
  const buckets = ['source-documents', 'generated-exports']
  
  for (const bucket of buckets) {
    const { data: bucketData, error: getError } = await supabase.storage.getBucket(bucket)
    if (getError || !bucketData) {
      console.log(`Creating bucket: ${bucket}...`)
      const { error: createError } = await supabase.storage.createBucket(bucket, {
        public: false,
        fileSizeLimit: 52428800, // 50MB
      })
      if (createError) {
        console.warn(`Note on bucket ${bucket}:`, createError.message)
      } else {
        console.log(`Bucket ${bucket} created successfully!`)
      }
    } else {
      console.log(`Bucket ${bucket} already exists.`)
    }
  }

  // 2. Check database tables
  console.log('Checking database tables...')
  const { data, error } = await supabase.from('source_documents').select('id').limit(1)
  if (error) {
    console.log('Table source_documents query result:', error.message)
  } else {
    console.log('Database table source_documents is ready and accessible!')
  }
}

main().catch(console.error)
