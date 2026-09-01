const VERCEL_TOKEN = process.env.VERCEL_TOKEN || process.argv[2]
const PROJECT_NAME = 'cbsjc-planeador-rag'

async function checkStatus() {
  console.log('Fetching latest deployment status from Vercel...')
  const res = await fetch(`https://api.vercel.com/v6/deployments?projectId=prj_l9RcuBX7NFPhELWY56BDxrxKaBR8&limit=1`, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  })

  const data = await res.json()
  const dep = data.deployments?.[0]
  if (!dep) {
    console.log('No deployment found.')
    return
  }

  console.log(`Deployment ID: ${dep.uid}`)
  console.log(`State: ${dep.state}`)
  console.log(`URL: https://${dep.url}`)
  if (dep.inspectorUrl) console.log(`Inspector: ${dep.inspectorUrl}`)
}

checkStatus().catch(console.error)
