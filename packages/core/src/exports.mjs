import { Document, Packer, Paragraph, TextRun } from 'docx'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
export const safeName = (t) =>
  t
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 70) || 'rose-jade-file'
export async function exportArtifact(row, format) {
  const text = row.content
  if (format === 'docx') {
    const doc = new Document({
      creator: 'Rose Jade AI',
      title: row.title,
      sections: [
        {
          children: [
            new Paragraph({ children: [new TextRun({ text: row.title, bold: true, size: 36 })] }),
            ...text
              .split('\n')
              .map(
                (line) => new Paragraph({ children: [new TextRun(line)], spacing: { after: 100 } }),
              ),
          ],
        },
      ],
    })
    return {
      bytes: await Packer.toBuffer(doc),
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
    }
  }
  if (format === 'pdf') {
    const pdf = await PDFDocument.create()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    let page = pdf.addPage([612, 792]),
      y = 740
    // The built-in font is Latin-1. Unsupported characters get a visible replacement;
    // the editable DOCX/text exports retain the original Unicode content.
    const normalized = (row.title + '\n\n' + text).replace(/[^\x20-\x7e\n\r\t]/g, '?')
    for (const source of normalized.split('\n')) {
      let line = ''
      const words = source.split(/\s+/)
      for (let word of words) {
        while (word.length > 80) {
          words.push(word.slice(80))
          word = word.slice(0, 80)
        }
        if (font.widthOfTextAtSize(line + word, 11) > 500) {
          if (y < 55) {
            page = pdf.addPage([612, 792])
            y = 740
          }
          page.drawText(line, { x: 55, y, size: 11, font, color: rgb(0.12, 0.2, 0.18) })
          y -= 17
          line = ''
        }
        line += word + ' '
      }
      if (y < 55) {
        page = pdf.addPage([612, 792])
        y = 740
      }
      page.drawText(line, { x: 55, y, size: 11, font })
      y -= 17
    }
    return { bytes: Buffer.from(await pdf.save()), mime: 'application/pdf', extension: 'pdf' }
  }
  const types = {
    md: 'text/markdown',
    txt: 'text/plain',
    html: 'text/html',
    json: 'application/json',
    csv: 'text/csv',
    py: 'text/plain',
    js: 'text/plain',
    ts: 'text/plain',
  }
  return {
    bytes: Buffer.from(text),
    mime: (types[format] || 'text/plain') + '; charset=utf-8',
    extension: format,
  }
}
export const escapeICS = (v) =>
  String(v || '')
    .replace(/\r?\n/g, '\\n')
    .replace(/([,;\\])/g, '\\$1')
export function calendar(records) {
  const stamp = (d) =>
    new Date(d)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rose Jade AI//Private Calendar//EN',
    ...records
      .filter((r) => r.kind === 'event')
      .flatMap((r) => [
        'BEGIN:VEVENT',
        'UID:' + r.id + '@rosejade',
        'DTSTAMP:' + stamp(r.created),
        'DTSTART:' + stamp(r.fields.start),
        'DTEND:' + stamp(r.fields.end),
        'SUMMARY:' + escapeICS(r.title),
        'LOCATION:' + escapeICS(r.fields.location),
        'DESCRIPTION:' + escapeICS(r.fields.detail),
        'END:VEVENT',
      ]),
    'END:VCALENDAR',
  ].join('\r\n')
}
