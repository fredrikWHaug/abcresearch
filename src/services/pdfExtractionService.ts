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
  private static readonly SUPABASE_URL = 'https://acswlqfhoqxemyxmscwp.supabase.co';
  private static readonly LOCAL_EDGE_FUNCTION_URL = 'http://localhost:54321/functions/v1/extract-pdf-tables';
  private static readonly PRODUCTION_EDGE_FUNCTION_URL = `${PDFExtractionService.SUPABASE_URL}/functions/v1/extract-pdf-tables`;
  
  private static getEdgeFunctionUrl(): string {
    // Use local URL in development, production URL otherwise
    return process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost'
      ? PDFExtractionService.LOCAL_EDGE_FUNCTION_URL
      : PDFExtractionService.PRODUCTION_EDGE_FUNCTION_URL;
  }

  /**
   * Extract all tables from a PDF file using Supabase Edge Function
   */
  static async extractTablesFromPDF(file: File, supabaseToken?: string): Promise<ExtractionResult> {
    try {
      const edgeFunctionUrl = PDFExtractionService.getEdgeFunctionUrl();
      const isLocal = edgeFunctionUrl.includes('localhost');
      
      if (isLocal) {
        // For local testing, call Python API directly
        console.log('Starting PDF table extraction via direct Python API...');
        return await this.extractTablesDirectly(file);
      } else {
        // For production, use Edge Function
        console.log('Starting PDF table extraction via Supabase Edge Function...');
        return await this.extractTablesViaEdgeFunction(file, supabaseToken);
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

    const response = await fetch('http://localhost:3000/api/extract_tables', {
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
   * Extract tables via Edge Function (for production)
   */
  private static async extractTablesViaEdgeFunction(file: File, supabaseToken?: string): Promise<ExtractionResult> {
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('file', file);

    // Call Supabase Edge Function
    const edgeFunctionUrl = PDFExtractionService.getEdgeFunctionUrl();
    console.log('Calling Edge Function at:', edgeFunctionUrl);

    // Prepare headers
    const headers: HeadersInit = {};
    if (supabaseToken) {
      headers['Authorization'] = `Bearer ${supabaseToken}`;
    }
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers,
      body: formData
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
