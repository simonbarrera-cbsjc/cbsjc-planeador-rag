const VERCEL_TOKEN = process.env.VERCEL_TOKEN || process.argv[2]
const PROJECT_NAME = 'cbsjc-planeador-rag'

async function getDomains() {
  const res = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_NAME}/domains`, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  })

  const data = await res.json()
  console.log('Project domains:', JSON.stringify(data.domains, null, 2))
}

getDomains().catch(console.error)
