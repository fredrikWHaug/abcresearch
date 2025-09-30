export interface ExtractedTable {
  data: string[][];
  pageNumber: number;
  tableNumber: number;
  rows?: number;
  columns?: number;
}

export interface ExtractionResult {
  success: boolean;
  tables: ExtractedTable[];
  error?: string;
  excelBlob?: Blob;
  message?: string;
}

export class PDFExtractionService {

  /**
   * Extract all tables from a PDF file using Supabase Edge Function as proxy
   */
  static async extractTablesFromPDF(file: File): Promise<ExtractionResult> {
    try {
      // Check if we're running locally or in production
      const isLocal = window.location.hostname === 'localhost';
      
      if (isLocal) {
        // For local testing, call Python API directly
        console.log('Starting PDF table extraction via direct Python API...');
        return await this.extractTablesDirectly(file);
      } else {
        // For production, use Supabase Edge Function as proxy
        console.log('Starting PDF table extraction via Supabase Edge Function...');
        return await this.extractTablesViaEdgeFunction(file);
      }
    } catch (error) {
      console.error('PDF extraction error:', error);
      return {
        success: false,
        tables: [],
        error: `Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Extract tables directly from Python API (for local testing)
   */
  private static async extractTablesDirectly(file: File): Promise<ExtractionResult> {
    // Convert file to base64 using a more reliable method
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64 using a binary string approach
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binaryString);

    // Use local Python server when running locally
    const isLocal = window.location.hostname === 'localhost';
    const pythonApiUrl = isLocal 
      ? 'http://localhost:3000/api/extract_tables'
      : (import.meta.env.VITE_PYTHON_API_URL || 'https://developent.guru/api/extract_tables');
    console.log('Using Python API URL:', pythonApiUrl);

    const response = await fetch(pythonApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pdf_data: base64,
        filename: file.name
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      return {
        success: false,
        tables: [],
        error: result.error || 'PDF processing failed'
      };
    }

    // Convert base64 Excel data to Blob
    let excelBlob: Blob | undefined;
    if (result.excel_data) {
      const excelBytes = this.base64ToArrayBuffer(result.excel_data);
      excelBlob = new Blob([excelBytes], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
    }

    // Convert tables to our expected format
    const tables: ExtractedTable[] = result.tables.map((table: any) => ({
      data: table.data,
      pageNumber: table.page_number,
      tableNumber: table.table_number,
      rows: table.rows,
      columns: table.columns
    }));

    console.log(`Successfully extracted ${tables.length} tables from PDF`);

    return {
      success: true,
      tables,
      excelBlob,
      message: result.message
    };
  }

  /**
   * Extract tables via Supabase Edge Function (for production)
   */
  private static async extractTablesViaEdgeFunction(file: File): Promise<ExtractionResult> {
    // Get Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing');
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Create FormData for the Edge Function
    const formData = new FormData();
    formData.append('file', file);
    
    console.log('Calling Supabase Edge Function...');
    
    const { data, error } = await supabase.functions.invoke('extract-pdf-tables', {
      body: formData
    });
    
    if (error) {
      throw new Error(`Edge Function error: ${error.message}`);
    }
    
    if (!data.success) {
      return {
        success: false,
        tables: [],
        error: data.error || 'PDF processing failed'
      };
    }
    
    // Convert base64 Excel data to Blob
    let excelBlob: Blob | undefined;
    if (data.excel_data) {
      const excelBytes = this.base64ToArrayBuffer(data.excel_data);
      excelBlob = new Blob([excelBytes], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
    }
    
    // Convert tables to our expected format
    const tables: ExtractedTable[] = data.tables.map((table: any) => ({
      data: table.data,
      pageNumber: table.page_number,
      tableNumber: table.table_number,
      rows: table.rows,
      columns: table.columns
    }));
    
    console.log(`Successfully extracted ${tables.length} tables from PDF`);
    
    return {
      success: true,
      tables,
      excelBlob,
      message: data.message
    };
  }

  
  /**
   * Convert base64 string to ArrayBuffer
   */
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
  
  /**
   * Download Excel file
   */
  static downloadExcelFile(blob: Blob, filename: string = 'extracted_tables.xlsx'): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
