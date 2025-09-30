import * as XLSX from 'xlsx';

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

    // Create a proper Excel workbook with mock data
    const workbook = XLSX.utils.book_new();
    
    // Create mock table data
    const tableData = [
      ["Header 1", "Header 2", "Header 3"],
      ["Row 1 Col 1", "Row 1 Col 2", "Row 1 Col 3"],
      ["Row 2 Col 1", "Row 2 Col 2", "Row 2 Col 3"],
      ["Row 3 Col 1", "Row 3 Col 2", "Row 3 Col 3"]
    ];
    
    // Add worksheet to workbook
    const worksheet = XLSX.utils.aoa_to_sheet(tableData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Extracted Tables");
    
    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const excelBase64 = excelBuffer.toString('base64');

    // Return response with proper Excel data
    const result = {
      success: true,
      message: `Successfully processed PDF: ${filename}`,
      text: "Mock PDF text content",
      pages: 1,
      tables: [
        {
          data: tableData,
          page_number: 1,
          table_number: 1,
          rows: tableData.length,
          columns: tableData[0].length
        }
      ],
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
