import 'server-only'
import { google } from 'googleapis'
import { markdownToPlainText } from '@/lib/utils'

if (typeof window !== 'undefined') {
  throw new Error('lib/export/gdocs.ts must only be used on the server.')
}

interface CreateGoogleDocParams {
  title: string
  content: string
  userEmail?: string
}

export async function createGoogleDoc(params: CreateGoogleDocParams): Promise<{ docId: string; docUrl: string }> {
  const { title, content, userEmail } = params

  if (!title || title.trim().length === 0) {
    throw new Error('createGoogleDoc: document title must not be empty.')
  }

  if (!content || content.trim().length === 0) {
    throw new Error('createGoogleDoc: document content must not be empty.')
  }

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON

  if (!serviceAccountJson) {
    throw new Error(
      'La variable de entorno GOOGLE_SERVICE_ACCOUNT_JSON no está configurada. ' +
      'Configura una cuenta de servicio de Google Cloud con las APIs de Google Drive y Google Docs activadas.'
    )
  }

  let credentials: Record<string, unknown>
  try {
    credentials = JSON.parse(serviceAccountJson)
  } catch (error) {
    throw new Error('El valor de GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido.')
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive',
    ],
  })

  const docs = google.docs({ version: 'v1', auth })
  const drive = google.drive({ version: 'v3', auth })

  // 1. Create a new Google Document
  const createRes = await docs.documents.create({
    requestBody: {
      title: `${title} - CBSJC`,
    },
  })

  const docId = createRes.data.documentId
  if (!docId) {
    throw new Error('No se pudo obtener el ID del documento de Google Docs creado.')
  }

  // 2. Insert formatted text into document
  const plainText = markdownToPlainText(content)
  const fullContent = `COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE\n${title}\n\n${plainText}\n`

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: fullContent,
          },
        },
      ],
    },
  })

  // 3. Share with user or make readable/editable
  if (userEmail) {
    try {
      await drive.permissions.create({
        fileId: docId,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: userEmail,
        },
        sendNotificationEmail: false,
      })
    } catch (permError) {
      console.warn('Could not share specifically with email, setting link permission:', permError)
      await drive.permissions.create({
        fileId: docId,
        requestBody: {
          role: 'writer',
          type: 'anyone',
        },
      })
    }
  } else {
    // Anyone with link can view/edit
    await drive.permissions.create({
      fileId: docId,
      requestBody: {
        role: 'writer',
        type: 'anyone',
      },
    })
  }

  const docUrl = `https://docs.google.com/document/d/${docId}/edit`
  return { docId, docUrl }
}
