async function testProdPdfDownload() {
  const docId = 'e5693811-059b-469e-889e-51aecb53e8ac'
  console.log(`Testing PDF export from production for doc ${docId}...`)
  
  const res = await fetch('https://cbsjc-planeador-rag.vercel.app/api/export', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      documentId: docId,
      format: 'pdf',
    }),
  })

  console.log('HTTP Status:', res.status)
  console.log('Content-Type:', res.headers.get('content-type'))
  
  if (res.ok) {
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    console.log(`SUCCESS! Received PDF: ${buffer.length} bytes (Starts with %PDF: ${buffer.slice(0, 4).toString()})`)
  } else {
    const errorText = await res.text()
    console.error('FAILED with error:', errorText)
  }
}

testProdPdfDownload().catch(console.error)
