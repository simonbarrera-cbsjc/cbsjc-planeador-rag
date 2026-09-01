import { execSync } from 'child_process'

const VERCEL_TOKEN = process.env.VERCEL_TOKEN || process.argv[2]
const GITHUB_PAT = process.env.GITHUB_PAT || process.argv[3]
const PROJECT_NAME = 'cbsjc-planeador-rag'
const GITHUB_REPO = 'simonbarrera-cbsjc/cbsjc-planeador-rag'

async function deploy() {
  console.log('1. Fetching GitHub repo details for repoId...')
  const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CBSJC-Deployment-Bot',
    },
  })
  const ghData = await ghRes.json()
  const repoId = ghData.id
  console.log(`GitHub Repo ID: ${repoId}`)

  // 2. Link Project on Vercel
  console.log('2. Linking GitHub repo to Vercel Project...')
  const linkRes = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_NAME}/link`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'github',
      repo: GITHUB_REPO,
    }),
  })
  console.log('Link status:', linkRes.status)

  // 3. Trigger Deployment via Vercel API
  console.log('3. Triggering Deployment...')
  const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: PROJECT_NAME,
      gitSource: {
        type: 'github',
        ref: 'main',
        repoId: repoId,
      },
    }),
  })

  const deployData = await deployRes.json()
  if (!deployRes.ok) {
    console.log('Deployment response:', deployData)
    console.log('\nDeploying via Vercel CLI directly...')
    try {
      execSync(`npx vercel --token ${VERCEL_TOKEN} --prod --yes`, { stdio: 'inherit' })
    } catch (err) {
      console.log('CLI deploy error:', err.message)
    }
  } else {
    console.log('\nDeployment successfully triggered on Vercel!')
    console.log(`URL: https://${deployData.url}`)
    console.log(`Ready State: ${deployData.readyState}`)
  }
}

deploy().catch(console.error)
