import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://yqygtibydldsuikktzao.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxeWd0aWJ5ZGxkc3Vpa2t0emFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODI4MjMwMCwiZXhwIjoyMTAzODU4MzAwfQ.lyIxUxXII7l4QziXAlT364Z_04AFt4aSQ30kP6yhA5I'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function setupTestUser() {
  const email = process.argv[2] || process.env.INITIAL_ADMIN_EMAIL || 'admin@sanjosebilingue.edu.co'
  const password = process.argv[3] || process.env.INITIAL_ADMIN_PASSWORD || 'TempPassword2026!'
  const fullName = process.argv[4] || 'Administrador CBSJC'

  console.log(`Checking or creating user: ${email}...`)

  const { data: existingUsers, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) {
    console.error('List users error:', listErr)
    return
  }

  let user = existingUsers.users.find((u) => u.email === email)

  if (!user) {
    console.log('User does not exist. Creating...')
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    })
    if (createErr) {
      console.error('Create user error:', createErr)
      return
    }
    user = newUser.user
    console.log('User created successfully:', user.id)
  } else {
    console.log('User exists. Updating password and confirming email...')
    const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    })
    if (updateErr) {
      console.error('Update user error:', updateErr)
      return
    }
    console.log('User updated successfully.')
  }

  // Ensure profile exists
  const { error: profileErr } = await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email,
    full_name: fullName,
    role: 'admin',
  })

  if (profileErr) {
    console.error('Profile upsert error:', profileErr)
  } else {
    console.log('Profile created/updated successfully with admin role!')
  }
}

setupTestUser().catch(console.error)
