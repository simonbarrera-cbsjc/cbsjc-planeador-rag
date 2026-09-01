import { execSync } from 'child_process'

const GITHUB_PAT = process.env.GITHUB_PAT || process.argv[2]
const REPO_NAME = 'cbsjc-planeador-rag'

if (!GITHUB_PAT) {
  console.error('Usage: node scripts/github-push.mjs <GITHUB_PAT>')
  process.exit(1)
}

async function setupGithub() {
  console.log('1. Checking GitHub authentication with PAT...')
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CBSJC-Deployment-Bot',
    },
  })

  if (!userRes.ok) {
    throw new Error(`GitHub Auth Failed: ${userRes.status} ${await userRes.text()}`)
  }

  const userData = await userRes.json()
  const username = userData.login
  console.log(`Authenticated as GitHub user: ${username}`)

  // 2. Ensure repo exists on GitHub
  console.log(`2. Ensuring repository '${REPO_NAME}' exists on GitHub...`)
  const checkRepoRes = await fetch(`https://api.github.com/repos/${username}/${REPO_NAME}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CBSJC-Deployment-Bot',
    },
  })

  let repoUrl = ''
  if (checkRepoRes.status === 404) {
    console.log(`Creating new GitHub repository: ${REPO_NAME}...`)
    const createRepoRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_PAT}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'CBSJC-Deployment-Bot',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: REPO_NAME,
        description: 'Sistema RAG y Planeador Curricular Inteligente para el Colegio Bilingüe San José Campestre',
        private: false,
        auto_init: false,
      }),
    })

    if (!createRepoRes.ok) {
      throw new Error(`Failed to create GitHub repo: ${createRepoRes.status} ${await createRepoRes.text()}`)
    }

    const createdData = await createRepoRes.json()
    repoUrl = createdData.html_url
    console.log(`Repository created: ${repoUrl}`)
  } else if (checkRepoRes.ok) {
    const existingData = await checkRepoRes.json()
    repoUrl = existingData.html_url
    console.log(`Repository already exists: ${repoUrl}`)
  }

  // 3. Reset and commit clean files
  console.log('3. Updating commit without secrets...')
  execSync('git add .', { stdio: 'inherit' })
  try {
    execSync('git commit --amend -m "feat: complete CBSJC RAG system with Gemini 2.0 Flash and Supabase pgvector"', { stdio: 'inherit' })
  } catch {
    execSync('git commit -m "feat: complete CBSJC RAG system with Gemini 2.0 Flash and Supabase pgvector"', { stdio: 'inherit' })
  }

  const remoteUrl = `https://${username}:${GITHUB_PAT}@github.com/${username}/${REPO_NAME}.git`
  try {
    execSync('git remote remove origin', { stdio: 'pipe' })
  } catch {}
  execSync(`git remote add origin ${remoteUrl}`, { stdio: 'pipe' })

  console.log('4. Pushing code to GitHub...')
  execSync('git push -u origin main --force', { stdio: 'inherit' })

  console.log(`\nSUCCESS! GitHub Repository published at:\n${repoUrl}\n`)
}

setupGithub().catch((err) => {
  console.error('Error during GitHub setup:', err)
  process.exit(1)
})
