const VERCEL_TOKEN = process.env.VERCEL_TOKEN || process.argv[2]
const DEPLOYMENT_ID = 'dpl_5UgBC3h42anNkRR3fdw79SWsRWYS'
const DOMAIN = 'cbsjc-planeador-rag.vercel.app'

async function assignAlias() {
  const res = await fetch(`https://api.vercel.com/v2/deployments/${DEPLOYMENT_ID}/aliases`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ alias: DOMAIN }),
  })

  const data = await res.json()
  console.log('Alias assigned:', data)
}

assignAlias().catch(console.error)
