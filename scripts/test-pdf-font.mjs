import { Font, Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import React from 'react'

Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf', fontWeight: 300 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf', fontWeight: 400 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf', fontWeight: 500 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 700 },
  ],
})

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Roboto' },
  title: { fontSize: 18, fontWeight: 700, color: '#0E1B4D' },
})

async function testPdf() {
  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(
        View,
        null,
        React.createElement(Text, { style: styles.title }, 'Colegio Bilingüe San José Campestre'),
        React.createElement(Text, null, 'Planning Book SJB-RGA006 - 100% Funcional sin dependencias AFM')
      )
    )
  )

  const buf = await renderToBuffer(doc)
  console.log('PDF rendered successfully! Bytes:', buf.length)
}

testPdf().catch(console.error)
