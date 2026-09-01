import fs from 'fs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const sql = fs.readFileSync('supabase/migrations/001_initial.sql', 'utf-8')

async function runSql() {
  console.log('Attempting to execute SQL migration via Supabase API...')
  
  // Try v1/query endpoint (available on some Supabase instances)
  try {
    const res = await fetch(`${url}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql })
    })
    console.log('RPC test status:', res.status)
  } catch (err) {
    console.log('Fetch error:', err.message)
  }
}

runSql()
