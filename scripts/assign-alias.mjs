const VERCEL_TOKEN = process.env.VERCEL_TOKEN || process.argv[2]
const DEPLOYMENT_ID = 'dpl_BtDM4Yf1fS5YS7ejyCRtCtnxbvfF'
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
  console.log('Alias assigned successfully:', data)
}

assignAlias().catch(console.error)
