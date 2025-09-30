import pdf from 'pdf-parse';
import { Readable } from 'stream';

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
    
    // Parse PDF
    const data = await pdf(pdfBuffer);
    
    // For now, return basic text extraction
    // TODO: Add table extraction logic
    const result = {
      success: true,
      message: `Successfully processed PDF: ${filename}`,
      text: data.text.substring(0, 1000), // First 1000 chars
      pages: data.numpages,
      tables: [] // TODO: Implement table extraction
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
