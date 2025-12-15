import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileSpreadsheet, Download, X, Loader2, CheckCircle, Trash2 } from 'lucide-react'
import { AnimatedGradientBackground } from '@/components/AnimatedGradientBackground'
import * as XLSX from 'xlsx'

interface ScriptData {
  id: string
  drugName: string
  quarter: string
  fileName: string
  uploadDate: string
  data: Record<string, unknown>[]
  revenueEstimate?: string
  consensus?: string
}

interface TemplateFile {
  fileName: string
  uploadDate: string
  data: Record<string, unknown>[]
}

interface TableCell {
  value: string
  editable: boolean
}

interface ModelingData {
  scriptId: string
  table: TableCell[][]
  isLoading: boolean
  isModeling: boolean
  isComplete: boolean
  downloadFileName?: string
}

export function AnalystPage() {
  const [scripts, setScripts] = useState<ScriptData[]>([])
  const [uploading, setUploading] = useState(false)
  const [drugName, setDrugName] = useState('')
  const [quarter, setQuarter] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  
  // Template file state
  const [templateFile, setTemplateFile] = useState<TemplateFile | null>(null)
  const [uploadingTemplate, setUploadingTemplate] = useState(false)
  const [selectedTemplateFile, setSelectedTemplateFile] = useState<File | null>(null)
  
  // Modeling state
  const [expandedScriptId, setExpandedScriptId] = useState<string | null>(null)
  const [modelingData, setModelingData] = useState<ModelingData | null>(null)
  const [modelingProgress, setModelingProgress] = useState(0)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleTemplateFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedTemplateFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !drugName.trim() || !quarter.trim()) {
      alert('Please provide drug name, quarter, and select an Excel file')
      return
    }

    setUploading(true)

    try {
      // Read the Excel file
      const fileBuffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(fileBuffer, { type: 'array' })
      
      // Get the first sheet
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      // Create script entry
      const newScript: ScriptData = {
        id: Date.now().toString(),
        drugName: drugName.trim(),
        quarter: quarter.trim(),
        fileName: selectedFile.name,
        uploadDate: new Date().toISOString(),
        data: jsonData as Record<string, unknown>[]
      }

      setScripts(prev => [...prev, newScript])

      // Reset form
      setDrugName('')
      setQuarter('')
      setSelectedFile(null)
      
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) {
        fileInput.value = ''
      }

      alert('Script uploaded successfully!')
    } catch (error) {
      console.error('Error uploading script:', error)
      alert(`Failed to upload script: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }

  const handleUploadTemplate = async () => {
    if (!selectedTemplateFile) {
      alert('Please select a template file')
      return
    }

    setUploadingTemplate(true)

    try {
      // Read the Excel file
      const fileBuffer = await selectedTemplateFile.arrayBuffer()
      const workbook = XLSX.read(fileBuffer, { type: 'array' })
      
      // Get the first sheet
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      // Set template file
      const newTemplate: TemplateFile = {
        fileName: selectedTemplateFile.name,
        uploadDate: new Date().toISOString(),
        data: jsonData as Record<string, unknown>[]
      }

      setTemplateFile(newTemplate)
      setSelectedTemplateFile(null)
      
      // Reset file input
      const fileInput = document.getElementById('template-file-upload') as HTMLInputElement
      if (fileInput) {
        fileInput.value = ''
      }

      alert('Template file uploaded successfully!')
    } catch (error) {
      console.error('Error uploading template:', error)
      alert(`Failed to upload template: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploadingTemplate(false)
    }
  }

  const handleDeleteTemplate = () => {
    if (confirm('Are you sure you want to delete the template file?')) {
      setTemplateFile(null)
    }
  }

  const handleDownloadTemplate = () => {
    if (!templateFile) return

    const worksheet = XLSX.utils.json_to_sheet(templateFile.data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template')

    XLSX.writeFile(workbook, templateFile.fileName)
  }

  const handleDownloadCombined = () => {
    if (scripts.length === 0) {
      alert('No scripts to download')
      return
    }

    // Combine all data with metadata
    const combinedData = scripts.flatMap(script => 
      script.data.map(row => ({
        'Drug Name': script.drugName,
        'Quarter': script.quarter,
        'File Name': script.fileName,
        ...row
      }))
    )

    // Create workbook
    const worksheet = XLSX.utils.json_to_sheet(combinedData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Combined Scripts')

    // Download
    XLSX.writeFile(workbook, `combined_scripts_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // First API call - Get initial model data
  const handleFillRevenueModel = async (scriptId: string) => {
    const script = scripts.find(s => s.id === scriptId)
    if (!script) return

    // Set loading state
    setExpandedScriptId(scriptId)
    setModelingData({
      scriptId,
      table: [],
      isLoading: true,
      isModeling: false,
      isComplete: false
    })

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Mock data for demonstration - Ohtuvayre Revenue Model
    const mockTable: TableCell[][] = [
      [
        { value: 'Variable', editable: false },
        { value: 'Value', editable: false },
        { value: 'Unit', editable: false },
        { value: 'Source', editable: false },
        { value: 'Notes', editable: false }
      ],
      [
        { value: 'Rx reported last quarter (Q1 2025)', editable: false },
        { value: '25,000 (approx.)', editable: true },
        { value: 'Prescriptions', editable: true },
        { value: 'Verona Pharma Q1 2025 financial results press release', editable: true },
        { value: 'Company reports "~25,000 prescriptions filled in Q1 2025" for Ohtuvayre; used as 25,000 for modeling.', editable: true }
      ],
      [
        { value: 'Rx reported two quarters ago (Q4 2024)', editable: false },
        { value: '', editable: true },
        { value: 'Prescriptions', editable: true },
        { value: 'Verona Pharma preliminary Q4 & FY 2024 highlights', editable: true },
        { value: 'Company discloses >16,000 prescriptions filled in 2024 (20 weeks post-launch), but does not break out Q4 prescriptions alone; quarter-specific Rx is therefore unavailable and left blank.', editable: true }
      ],
      [
        { value: 'Scripts data last quarter (Q1 2025, Adjusted row)', editable: false },
        { value: '13,032', editable: true },
        { value: 'Scripts (vendor, adjusted)', editable: true },
        { value: '"OHTUVAYRE Script Data" tab (Adjusted row, weekly data summed Jan 1–Mar 31 2025)', editable: true },
        { value: 'Sum of weekly Adjusted scripts in Tab 1 for Q1 2025. Computed and then linked via SUMIFS in the model.', editable: true }
      ],
      [
        { value: 'Scripts data coverage rate (Q1 2025)', editable: false },
        { value: '52.1%', editable: true },
        { value: '% (vendor scripts / reported Rx)', editable: true },
        { value: 'Tab 1 Q1 scripts + Q1 2025 PR prescriptions', editable: true },
        { value: '13,032 (scripts data) ÷ 25,000 (reported prescriptions) ≈ 0.521. This coverage rate is used to map vendor data to total market prescriptions.', editable: true }
      ],
      [
        { value: 'Net sales – last quarter (Q1 2025, Ohtuvayre)', editable: false },
        { value: '71,300,000', editable: true },
        { value: 'USD', editable: true },
        { value: 'Verona Pharma Q1 2025 PR ("Ohtuvayre net sales of $71.3 million")', editable: true },
        { value: 'Entered as 71,300,000 (full dollars) into G5. Label still says "$m", but per your instructions we use full dollars.', editable: true }
      ],
      [
        { value: 'Net sales – two quarters ago (Q4 2024, Ohtuvayre)', editable: false },
        { value: '36,000,000 (approx.)', editable: true },
        { value: 'USD', editable: true },
        { value: 'Verona preliminary Q4 2024 PR: "net product sales… approximately $36 million"', editable: true },
        { value: 'Entered as 36,000,000 in G6. Figure is preliminary but widely referenced; sufficient for historical calibration.', editable: true }
      ],
      [
        { value: 'Volume of prescriptions reported (Q1 2025)', editable: false },
        { value: '25,000 (approx.)', editable: true },
        { value: 'Prescriptions', editable: true },
        { value: 'Q1 2025 PR Ohtuvayre performance metrics', editable: true },
        { value: '"Approximately 25,000 prescriptions filled" is used for both Rx reported and Volume reported in the "Last quarter" row.', editable: true }
      ],
      [
        { value: 'Gross to net (GTN) percentage (ratio of net / WAC)', editable: false },
        { value: '96.7% net / WAC (implied)', editable: true },
        { value: '% (net price ÷ gross price)', editable: true },
        { value: 'Q1 2025 PR net sales + prescriptions and FiercePharma WAC article', editable: true },
        { value: 'Net price per script ≈ $71.3m ÷ 25,000 ≈ $2,852. WAC ≈ $2,950/month. Implied GTN ratio = 2,852 ÷ 2,950 ≈ 96.7% (≈3.3% discount). Very low vs typical US COPD GTN; treat as an early-launch implied figure, not steady-state.', editable: true }
      ],
      [
        { value: 'Net price per script', editable: false },
        { value: '2,852', editable: true },
        { value: 'USD / prescription', editable: true },
        { value: 'Derived from Q1 2025 Ohtuvayre net sales & prescriptions', editable: true },
        { value: 'Used as E21 in the model. Net price = 71.3m ÷ 25k = $2,852 per filled prescription (approximate).', editable: true }
      ],
      [
        { value: 'Gross Listing Price (WAC)', editable: false },
        { value: '2,950', editable: true },
        { value: 'USD / monthly dose (standard supply)', editable: true },
        { value: 'FiercePharma: Verona to charge $2,950 per monthly dose; annual list price $35,400', editable: true },
        { value: 'Entered as C9 = 2,950 and linked as D19 (=C9). Assumes 1 script ≈ 1 monthly supply.', editable: true }
      ],
      [
        { value: 'Estimated wholesaler/pharmacy inventory', editable: false },
        { value: '≈2 weeks of demand', editable: true },
        { value: 'Weeks of script demand', editable: true },
        { value: 'Preliminary Q4 2024 PR: company "maintaining approximately two weeks of inventory at the specialty pharmacies"', editable: true },
        { value: 'Management commentary suggests ~2 weeks of inventory in the launch period. For the Q2 model I assume no net inventory build/draw (D16 = 0) but keep the qualitative 2-week level in mind.', editable: true }
      ],
      [
        { value: 'Analyst consensus revenue estimate (Q2 2025)', editable: false },
        { value: '90,410,000', editable: true },
        { value: 'USD', editable: true },
        { value: 'MarketBeat VRNA earnings page (Q2 2025 revenue estimate $90.41M)', editable: true },
        { value: 'Entered as D30 = 90,410,000 in the model. This is the Street consensus prior to the Q2\'25 print.', editable: true }
      ],
      [
        { value: 'Actual reported net revenue (Q2 2025, total Verona)', editable: false },
        { value: '103,140,000', editable: true },
        { value: 'USD', editable: true },
        { value: 'MarketBeat: Q2 2025 actual revenue $103.14M vs $90.41M estimate', editable: true },
        { value: 'Used only as a sanity check, not for calibration.', editable: true }
      ],
      [
        { value: 'Estimated total prescriptions (Q2 2025, model)', editable: false },
        { value: '~43,400', editable: true },
        { value: 'Prescriptions', editable: true },
        { value: 'Tab 1 Q2 scripts + modeled capture rate', editable: true },
        { value: 'From Tab 1, Q2 2025 Adjusted scripts = 22,942. Using average capture rate of ~52.9% (Q1 and Q4), estimated total prescriptions = 22,942 ÷ 0.5287 ≈ 43,400.', editable: true }
      ],
      [
        { value: 'Estimated net revenue (Q2 2025, model)', editable: false },
        { value: '~123,800,000', editable: true },
        { value: 'USD', editable: true },
        { value: 'Model calculation (Tab 2, "Estimated Total Revenue")', editable: true },
        { value: 'Using net price = $2,852 and scripts ≈ 43,400 (no net inventory change): estimated net revenue ≈ $123.8M. This is what the updated Excel model will compute in D23, driven by D13 and E21.', editable: true }
      ]
    ]

    setModelingData({
      scriptId,
      table: mockTable,
      isLoading: false,
      isModeling: false,
      isComplete: false
    })

    // TODO: Replace with actual OpenAI API call when ready
    /*
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY || ''}`
        },
        body: JSON.stringify({
          model: 'o1',
          messages: [
            {
              role: 'user',
              content: '' // TODO: Add prompt here - user will fill this in later
            }
          ]
        })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch model data')
      }

      const data = await response.json()
      // Parse response into table format
    } catch (error) {
      console.error('Error fetching model data:', error)
      alert(`Failed to fetch model data: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setExpandedScriptId(null)
      setModelingData(null)
    }
    */
  }

  // Second API call - Begin modeling with edited table
  const handleBeginModeling = async () => {
    if (!modelingData) {
      alert('Missing required data for modeling')
      return
    }

    const script = scripts.find(s => s.id === modelingData.scriptId)
    if (!script) return

    setModelingData(prev => prev ? { ...prev, isModeling: true } : null)
    setModelingProgress(0)

    // Simulate progress over 3 seconds
    const duration = 3000
    const steps = 30
    const interval = duration / steps

    for (let i = 0; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, interval))
      setModelingProgress((i / steps) * 100)
    }

    // Mock successful response
    console.log('Modeling complete with data:', {
      tableData: modelingData.table,
      scriptData: script.data,
      templateData: templateFile?.data || null
    })

    // Update the script with revenue estimate and consensus
    setScripts(prev => prev.map(s => 
      s.id === script.id 
        ? { ...s, revenueEstimate: '$120m', consensus: '$90m' }
        : s
    ))
    
    // Mark modeling as complete and store filename for download
    const fileName = `revenue_model_${script.drugName}_${script.quarter}_${new Date().toISOString().split('T')[0]}.xlsx`
    setModelingData(prev => prev ? { 
      ...prev, 
      isModeling: false, 
      isComplete: true,
      downloadFileName: fileName
    } : null)
    setModelingProgress(100)

    // TODO: Replace with actual OpenAI API call when ready
    /*
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY || ''}`
        },
        body: JSON.stringify({
          model: 'o1',
          messages: [
            {
              role: 'user',
              content: JSON.stringify({
                // TODO: Add prompt here - user will fill this in later
                prompt: '',
                tableData: modelingData.table,
                scriptData: script.data,
                templateData: templateFile.data
              })
            }
          ]
        })
      })

      if (!response.ok) {
        throw new Error('Failed to complete modeling')
      }

      const data = await response.json()
      // Handle modeling results
    } catch (error) {
      console.error('Error during modeling:', error)
      alert(`Failed to complete modeling: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setModelingData(prev => prev ? { ...prev, isModeling: false } : null)
    }
    */
  }

  const handleClosePanel = () => {
    setExpandedScriptId(null)
    setModelingData(null)
  }

  const handleCellEdit = (rowIndex: number, colIndex: number, newValue: string) => {
    if (!modelingData) return

    const newTable = modelingData.table.map((row, rIdx) =>
      row.map((cell, cIdx) => {
        if (rIdx === rowIndex && cIdx === colIndex && cell.editable) {
          return { ...cell, value: newValue }
        }
        return cell
      })
    )

    setModelingData({ ...modelingData, table: newTable })
  }

  const handleBatchProcess = () => {
    alert('Batch processing will be implemented to process multiple scripts at once.')
  }

  const handleDownloadModel = () => {
    if (!modelingData || !modelingData.downloadFileName) return

    const script = scripts.find(s => s.id === modelingData.scriptId)
    if (!script) return

    // Download the template file (or create a new one if no template)
    if (templateFile) {
      const worksheet = XLSX.utils.json_to_sheet(templateFile.data)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Revenue Model')
      XLSX.writeFile(workbook, modelingData.downloadFileName)
    } else {
      // Create a new workbook with the model data
      const modelData = modelingData.table.slice(1).map(row => ({
        Variable: row[0].value,
        Value: row[1].value,
        Unit: row[2].value,
        Source: row[3].value,
        Notes: row[4].value
      }))
      const worksheet = XLSX.utils.json_to_sheet(modelData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Revenue Model')
      XLSX.writeFile(workbook, modelingData.downloadFileName)
    }
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Animated Gradient Background */}
      <AnimatedGradientBackground />

      <div className="px-6 py-10 max-w-7xl mx-auto w-full relative z-10 flex flex-col gap-6">
        {/* Header */}
        <div className="bg-white/60 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-white/50">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Scripts Analyst
          </h1>
          <p className="text-gray-600 text-lg">
            Upload and manage prescription scripts data by drug and quarter
          </p>
        </div>

        {/* Upload Container */}
        <Card className="bg-white/70 backdrop-blur-xl border-white/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Script Data
            </CardTitle>
            <CardDescription>
              Upload an Excel sheet with script data and specify the drug name and quarter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Drug Name Input */}
              <div>
                <label htmlFor="drug-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Drug Name
                </label>
                <input
                  id="drug-name"
                  type="text"
                  value={drugName}
                  onChange={(e) => setDrugName(e.target.value)}
                  placeholder="e.g., Keytruda"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={uploading}
                />
              </div>

              {/* Quarter Input */}
              <div>
                <label htmlFor="quarter" className="block text-sm font-medium text-gray-700 mb-2">
                  Quarter
                </label>
                <input
                  id="quarter"
                  type="text"
                  value={quarter}
                  onChange={(e) => setQuarter(e.target.value)}
                  placeholder="e.g., 2Q2025"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={uploading}
                />
              </div>
            </div>

            {/* File Upload */}
            <div>
              <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">
                Excel File
              </label>
              <div className="flex items-center gap-4">
                <label
                  htmlFor="file-upload"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 cursor-pointer transition-colors bg-white/50"
                >
                  <FileSpreadsheet className="h-6 w-6 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {selectedFile ? selectedFile.name : 'Click to select Excel file (.xlsx, .xls)'}
                  </span>
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading}
                />
              </div>
            </div>

            {/* Upload Button */}
            <div className="flex justify-end gap-3">
              {scripts.length > 0 && (
                <Button
                  onClick={handleDownloadCombined}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Combined Data
                </Button>
              )}
              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !drugName.trim() || !quarter.trim()}
                className="bg-blue-600 hover:bg-blue-700 gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading...' : 'Upload Script'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Template File Upload Container */}
        <Card className="bg-white/70 backdrop-blur-xl border-white/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-purple-600" />
              Template File
            </CardTitle>
            <CardDescription>
              Upload a template Excel file for reference or standardization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Show uploaded template or upload interface */}
            {templateFile ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="font-medium text-gray-900">{templateFile.fileName}</p>
                      <p className="text-sm text-gray-600">
                        {templateFile.data.length} rows • Uploaded {new Date(templateFile.uploadDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleDownloadTemplate}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                    <Button
                      onClick={handleDeleteTemplate}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* File Upload */}
                <div>
                  <label htmlFor="template-file-upload" className="block text-sm font-medium text-gray-700 mb-2">
                    Template Excel File
                  </label>
                  <div className="flex items-center gap-4">
                    <label
                      htmlFor="template-file-upload"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-purple-300 rounded-lg hover:border-purple-400 cursor-pointer transition-colors bg-white/50"
                    >
                      <FileSpreadsheet className="h-6 w-6 text-purple-400" />
                      <span className="text-sm text-gray-600">
                        {selectedTemplateFile ? selectedTemplateFile.name : 'Click to select template Excel file (.xlsx, .xls)'}
                      </span>
                    </label>
                    <input
                      id="template-file-upload"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleTemplateFileSelect}
                      className="hidden"
                      disabled={uploadingTemplate}
                    />
                  </div>
                </div>

                {/* Upload Button */}
                <div className="flex justify-end">
                  <Button
                    onClick={handleUploadTemplate}
                    disabled={uploadingTemplate || !selectedTemplateFile}
                    className="bg-purple-600 hover:bg-purple-700 gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {uploadingTemplate ? 'Uploading...' : 'Upload Template'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Scripts Table */}
        {scripts.length > 0 && (
          <Card className="bg-white/70 backdrop-blur-xl border-white/50 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Uploaded Scripts ({scripts.length})</CardTitle>
                  <CardDescription className="mt-2">
                    View and manage your uploaded script data
                  </CardDescription>
                </div>
                <Button
                  onClick={handleBatchProcess}
                  className="bg-indigo-600 hover:bg-indigo-700 gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Batch process
                </Button>
              </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Drug Name
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Quarter
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          File Name
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Rows
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Upload Date
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Revenue Est.
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Consensus
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Revenue Model
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {scripts.map((script) => (
                        <tr key={script.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                              <span className="font-medium text-gray-900">{script.drugName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                            {script.quarter}
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            {script.fileName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                            {script.data.length}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                            {new Date(script.uploadDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {script.revenueEstimate ? (
                              <span className="text-green-700 font-semibold">{script.revenueEstimate}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {script.consensus ? (
                              <span className="text-blue-700 font-semibold">{script.consensus}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Button
                              onClick={() => handleFillRevenueModel(script.id)}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white gap-2"
                            >
                              Fill revenue model
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
        )}

        {/* Empty State */}
        {scripts.length === 0 && (
          <Card className="bg-white/70 backdrop-blur-xl border-white/50 shadow-lg">
            <CardContent className="py-12 text-center">
              <FileSpreadsheet className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Scripts Uploaded</h3>
              <p className="text-gray-600">
                Upload your first Excel sheet to get started with script analysis
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal - Revenue Model */}
      {expandedScriptId && modelingData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-[95vw] h-[90vh] bg-white shadow-2xl flex flex-col overflow-hidden">
            <CardHeader className="border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  Revenue Model - Ohtuvayre
                </CardTitle>
                <Button
                  onClick={handleClosePanel}
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
              <CardDescription className="text-base mt-2">
                Review and edit the model parameters below
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6 flex-1 overflow-auto">
              {modelingData.isLoading ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
                  <p className="text-gray-600 text-lg">Generating model parameters...</p>
                </div>
              ) : (
                <>
                  {/* Editable Table */}
                  <div className="overflow-auto border border-gray-200 rounded-lg">
                    <table className="w-full border-collapse text-sm">
                      <tbody>
                        {modelingData.table.map((row, rowIndex) => (
                          <tr key={rowIndex} className={rowIndex === 0 ? 'bg-gray-50 sticky top-0' : 'hover:bg-gray-50'}>
                            {row.map((cell, colIndex) => (
                              <td
                                key={colIndex}
                                className={`border border-gray-200 px-4 py-3 ${
                                  !cell.editable ? 'bg-gray-50 font-semibold text-gray-900' : ''
                                } ${colIndex === 0 ? 'w-[20%]' : colIndex === 4 ? 'w-[30%]' : 'w-[12.5%]'}`}
                              >
                                {cell.editable ? (
                                  <input
                                    type="text"
                                    value={cell.value}
                                    onChange={(e) => handleCellEdit(rowIndex, colIndex, e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded"
                                  />
                                ) : (
                                  <span className="text-gray-900">{cell.value}</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Progress Bar */}
                  {modelingData.isModeling && (
                    <div className="space-y-3 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 font-medium">Processing model...</span>
                        <span className="text-gray-900 font-semibold">{Math.round(modelingProgress)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${modelingProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-500 text-center">Generating revenue model and preparing download...</p>
                    </div>
                  )}

                  {/* Complete State - Download Option */}
                  {modelingData.isComplete && (
                    <div className="space-y-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-center gap-3 p-6 bg-green-50 rounded-lg border border-green-200">
                        <CheckCircle className="h-8 w-8 text-green-600 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-green-900 text-lg">Modeling Complete!</h4>
                          <p className="text-green-700 text-sm mt-1">
                            Revenue estimate: <span className="font-bold">$120m</span> • Consensus: <span className="font-bold">$90m</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        <Button
                          onClick={handleClosePanel}
                          variant="outline"
                          size="lg"
                        >
                          Close
                        </Button>
                        <Button
                          onClick={handleDownloadModel}
                          size="lg"
                          className="bg-green-600 hover:bg-green-700 gap-2"
                        >
                          <Download className="h-5 w-5" />
                          Download Excel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  {!modelingData.isModeling && !modelingData.isComplete && (
                    <div className="flex justify-end pt-4 border-t border-gray-200">
                      <Button
                        onClick={handleBeginModeling}
                        size="lg"
                        className="bg-blue-600 hover:bg-blue-700 gap-2"
                      >
                        <CheckCircle className="h-5 w-5" />
                        Accept and begin modeling
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

