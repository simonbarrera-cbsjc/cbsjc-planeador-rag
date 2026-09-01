const VERCEL_TOKEN = process.env.VERCEL_TOKEN || process.argv[2]
const DEPLOYMENT_ID = 'dpl_5urCaQ28wiqeRuBzxEhzVSf27A8k'

async function getDetails() {
  const res = await fetch(`https://api.vercel.com/v13/deployments/${DEPLOYMENT_ID}`, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  })

  const data = await res.json()
  console.log('Error details:', JSON.stringify(data.errorMessage || data.error || data, null, 2))
}

getDetails().catch(console.error)
