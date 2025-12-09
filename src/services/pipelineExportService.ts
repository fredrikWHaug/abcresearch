import pptxgen from 'pptxgenjs'
import type { PipelineDrugCandidate } from '@/types/pipeline'

/**
 * Export pipeline candidates to PowerPoint presentation
 */
export async function exportPipelineToPPT(
  candidates: PipelineDrugCandidate[],
  query?: string
): Promise<void> {
  const pptx = new pptxgen()

  // Slide 1: Title Slide
  const titleSlide = pptx.addSlide()
  titleSlide.background = { color: '1F2937' } // gray-800

  titleSlide.addText('Asset Development Pipeline', {
    x: 0.5,
    y: 2,
    w: 9,
    h: 1,
    fontSize: 44,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
  })

  if (query) {
    titleSlide.addText(`Search: ${query}`, {
      x: 0.5,
      y: 3.2,
      w: 9,
      h: 0.5,
      fontSize: 18,
      color: 'D1D5DB', // gray-300
      align: 'center',
    })
  }

  titleSlide.addText(`${candidates.length} Drug Candidates`, {
    x: 0.5,
    y: 4,
    w: 9,
    h: 0.4,
    fontSize: 16,
    color: '93C5FD', // blue-300
    align: 'center',
  })

  titleSlide.addText(new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }), {
    x: 0.5,
    y: 5.2,
    w: 9,
    h: 0.3,
    fontSize: 12,
    color: '9CA3AF', // gray-400
    align: 'center',
  })

  // Slide 2+: Pipeline Table (split into chunks if needed)
  const rowsPerSlide = 8 // Limit rows per slide for readability
  const chunkedCandidates = chunkArray(candidates, rowsPerSlide)

  chunkedCandidates.forEach((chunk, slideIndex) => {
    const dataSlide = pptx.addSlide()
    dataSlide.background = { color: 'FFFFFF' }

    // Header
    dataSlide.addText('Asset Development Pipeline', {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.4,
      fontSize: 24,
      bold: true,
      color: '1F2937',
    })

    if (chunkedCandidates.length > 1) {
      dataSlide.addText(`Page ${slideIndex + 1} of ${chunkedCandidates.length}`, {
        x: 8.5,
        y: 0.35,
        w: 1,
        h: 0.3,
        fontSize: 10,
        color: '6B7280',
        align: 'right',
      })
    }

    // Table headers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tableData: any[] = [
      [
        { text: '#', options: { bold: true, color: 'FFFFFF', fill: '1F2937', fontSize: 10 } },
        { text: 'Drug Candidate', options: { bold: true, color: 'FFFFFF', fill: '1F2937', fontSize: 10 } },
        { text: 'Sponsor', options: { bold: true, color: 'FFFFFF', fill: '1F2937', fontSize: 10 } },
        { text: 'Stage', options: { bold: true, color: 'FFFFFF', fill: '1F2937', fontSize: 10 } },
        { text: 'Technologies', options: { bold: true, color: 'FFFFFF', fill: '1F2937', fontSize: 10 } },
        { text: 'Mechanism', options: { bold: true, color: 'FFFFFF', fill: '1F2937', fontSize: 10 } },
        { text: 'Indications', options: { bold: true, color: 'FFFFFF', fill: '1F2937', fontSize: 10 } },
      ],
    ]

    // Table rows
    chunk.forEach((candidate, index) => {
      const globalIndex = slideIndex * rowsPerSlide + index + 1
      const rowColor = index % 2 === 0 ? 'F9FAFB' : 'FFFFFF' // Alternating row colors

      tableData.push([
        { text: `${globalIndex}`, options: { fontSize: 9, fill: rowColor, valign: 'top' } },
        { 
          text: candidate.commercialName 
            ? `${candidate.commercialName}\n(${candidate.scientificName})`
            : candidate.scientificName,
          options: { fontSize: 9, bold: true, fill: rowColor, valign: 'top' } 
        },
        { text: candidate.sponsorCompany, options: { fontSize: 9, fill: rowColor, valign: 'top' } },
        { 
          text: candidate.stage, 
          options: { 
            fontSize: 9, 
            bold: true,
            color: getStageBadgeColor(candidate.stage),
            fill: rowColor,
            valign: 'top'
          } 
        },
        { text: candidate.technologies || 'N/A', options: { fontSize: 8, fill: rowColor, valign: 'top' } },
        { text: truncateText(candidate.mechanismOfAction || 'N/A', 50), options: { fontSize: 8, fill: rowColor, valign: 'top' } },
        { 
          text: candidate.indications && candidate.indications.length > 0 
            ? candidate.indications.slice(0, 3).join(', ') + (candidate.indications.length > 3 ? '...' : '')
            : 'N/A',
          options: { fontSize: 8, fill: rowColor, valign: 'top' } 
        },
      ])
    })

    // Add table to slide
    dataSlide.addTable(tableData, {
      x: 0.3,
      y: 0.9,
      w: 9.4,
      h: 4.8,
      colW: [0.3, 1.8, 1.3, 0.9, 1.1, 1.8, 2.2],
      border: { pt: 1, color: 'E5E7EB' },
      autoPage: false,
      autoPageRepeatHeader: false,
      autoPageLineWeight: 0,
    })

    // Summary footer
    dataSlide.addText(`Total: ${candidates.length} candidates | Generated: ${new Date().toLocaleString()}`, {
      x: 0.3,
      y: 5.9,
      w: 9.4,
      h: 0.2,
      fontSize: 8,
      color: '6B7280',
      italic: true,
    })
  })

  // Slide 3: Summary Statistics
  const summarySlide = pptx.addSlide()
  summarySlide.background = { color: 'FFFFFF' }

  summarySlide.addText('Pipeline Summary', {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.4,
    fontSize: 24,
    bold: true,
    color: '1F2937',
  })

  // Calculate statistics
  const stats = {
    total: candidates.length,
    marketed: candidates.filter(c => c.stage === 'Marketed').length,
    phaseIII: candidates.filter(c => c.stage === 'Phase III').length,
    phaseII: candidates.filter(c => c.stage === 'Phase II').length,
    phaseI: candidates.filter(c => c.stage === 'Phase I').length,
    preClinical: candidates.filter(c => c.stage === 'Pre-Clinical').length,
  }

  // Summary boxes
  const summaryData = [
    { label: 'Total Candidates', value: stats.total, color: '3B82F6' },
    { label: 'Marketed', value: stats.marketed, color: '10B981' },
    { label: 'Phase III', value: stats.phaseIII, color: '3B82F6' },
    { label: 'Phase II', value: stats.phaseII, color: 'F59E0B' },
    { label: 'Phase I', value: stats.phaseI, color: 'F97316' },
    { label: 'Pre-Clinical', value: stats.preClinical, color: 'A855F7' },
  ]

  summaryData.forEach((item, index) => {
    const row = Math.floor(index / 3)
    const col = index % 3
    const x = 0.5 + col * 3.2
    const y = 1.2 + row * 1.5

    summarySlide.addShape('rect', {
      x,
      y,
      w: 2.8,
      h: 1.2,
      fill: { type: 'solid', color: item.color, transparency: 10 },
      line: { color: item.color, width: 2 },
    })

    summarySlide.addText(String(item.value), {
      x,
      y: y + 0.2,
      w: 2.8,
      h: 0.5,
      fontSize: 36,
      bold: true,
      color: item.color,
      align: 'center',
    })

    summarySlide.addText(item.label, {
      x,
      y: y + 0.7,
      w: 2.8,
      h: 0.3,
      fontSize: 12,
      color: '374151',
      align: 'center',
    })
  })

  // Download the presentation
  const fileName = `Asset-Pipeline-${new Date().toISOString().split('T')[0]}.pptx`
  await pptx.writeFile({ fileName })
}

/**
 * Get stage badge color for PowerPoint (hex color)
 */
export function getStageBadgeColor(stage: string): string {
  switch (stage) {
    case 'Marketed':
      return '10B981' // green-500
    case 'Phase III':
      return '3B82F6' // blue-500
    case 'Phase II':
      return 'F59E0B' // yellow-500
    case 'Phase I':
      return 'F97316' // orange-500
    case 'Pre-Clinical':
      return 'A855F7' // purple-500
    default:
      return '6B7280' // gray-500
  }
}

/**
 * Truncate text to a maximum length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

/**
 * Split array into chunks
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

