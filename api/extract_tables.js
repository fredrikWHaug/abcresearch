import * as XLSX from 'xlsx';
import pdf from 'pdf-parse/lib/pdf-parse.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pdf_data, filename } = req.body;
    
    if (!pdf_data) {
      return res.status(400).json({ error: 'No PDF data provided' });
    }

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(pdf_data, 'base64');
    
    // Parse PDF using pdf-parse (lighter weight library)
    const pdfData = await pdf(pdfBuffer);
    const text = pdfData.text;
    const numPages = pdfData.numpages;
    
    console.log('Extracted PDF text:', text.substring(0, 200) + '...');
    
    // Simple table extraction from text
    // Look for patterns that might be tables
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Try to find table-like patterns
    const tables = [];
    let currentTable = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for lines that might be table rows (contain multiple words/numbers)
      if (line.includes(' ') && line.split(/\s+/).length >= 2) {
        const cells = line.split(/\s+/);
        currentTable.push(cells);
      } else if (currentTable.length > 0) {
        // End of table, save it
        if (currentTable.length > 1) { // Only save tables with at least 2 rows
          tables.push({
            data: currentTable,
            page_number: 1,
            table_number: tables.length + 1,
            rows: currentTable.length,
            columns: currentTable[0]?.length || 0
          });
        }
        currentTable = [];
      }
    }
    
    // Save the last table if it exists
    if (currentTable.length > 1) {
      tables.push({
        data: currentTable,
        page_number: 1,
        table_number: tables.length + 1,
        rows: currentTable.length,
        columns: currentTable[0]?.length || 0
      });
    }
    
    // If no tables found, create a simple text-based table
    if (tables.length === 0) {
      const textLines = lines.slice(0, 10); // Take first 10 lines
      const simpleTable = textLines.map(line => [line.trim()]);
      tables.push({
        data: simpleTable,
        page_number: 1,
        table_number: 1,
        rows: simpleTable.length,
        columns: 1
      });
    }

    // Create Excel workbook with extracted data
    const workbook = XLSX.utils.book_new();
    
    tables.forEach((table, index) => {
      const worksheet = XLSX.utils.aoa_to_sheet(table.data);
      const sheetName = `Table ${index + 1}`;
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });
    
    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const excelBase64 = excelBuffer.toString('base64');

    // Return response with extracted data
    const result = {
      success: true,
      message: `Successfully processed PDF: ${filename}`,
      text: text.substring(0, 500), // First 500 chars
      pages: numPages,
      tables: tables,
      excel_data: excelBase64
    };

    res.status(200).json(result);
    
  } catch (error) {
    console.error('PDF processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process PDF',
      details: error.message 
    });
  }
}
