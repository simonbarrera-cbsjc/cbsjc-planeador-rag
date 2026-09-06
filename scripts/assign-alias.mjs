const VERCEL_TOKEN = process.env.VERCEL_TOKEN || process.argv[2]
const DEPLOYMENT_ID = process.argv[3]
const DOMAIN = 'cbsjc-planeador-rag.vercel.app'

async function assignAlias() {
  let depId = DEPLOYMENT_ID

  if (!depId) {
    console.log('No deployment ID provided, fetching latest ready deployment...')
    const res = await fetch(`https://api.vercel.com/v6/deployments?projectId=prj_l9RcuBX7NFPhELWY56BDxrxKaBR8&limit=1`, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    })
    const data = await res.json()
    const dep = data.deployments?.[0]
    if (!dep) {
      console.log('No deployment found.')
      return
    }
    depId = dep.uid
    console.log(`Using latest deployment: ${depId} (${dep.state})`)
  }

  console.log(`Assigning alias ${DOMAIN} to deployment ${depId}...`)
  const aliasRes = await fetch(`https://api.vercel.com/v2/deployments/${depId}/aliases`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      alias: DOMAIN,
    }),
  })

  const aliasData = await aliasRes.json()
  console.log('Alias response:', aliasData)
}

assignAlias().catch(console.error)

