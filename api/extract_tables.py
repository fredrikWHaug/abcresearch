import json
import base64
import io
import pdfplumber
import pandas as pd
from typing import List, Dict, Any
import traceback

def handler(request):
    """
    Vercel Python serverless function handler
    """
    # Set CORS headers
    headers = {
        'Access-Control-Allow-Origin': 'https://www.developent.guru',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json'
    }

    try:
        # Handle CORS preflight requests
        if request.method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'message': 'CORS preflight'})
            }

        # Only allow POST requests
        if request.method != 'POST':
            return {
                'statusCode': 405,
                'headers': headers,
                'body': json.dumps({'error': 'Method not allowed'})
            }

        # Parse request body
        if hasattr(request, 'json'):
            data = request.json
        else:
            data = json.loads(request.body) if hasattr(request, 'body') else {}

        pdf_data = data.get('pdf_data')
        filename = data.get('filename', 'document.pdf')

        if not pdf_data:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'error': 'No PDF data provided'
                })
            }

        # Decode base64 PDF data
        pdf_bytes = base64.b64decode(pdf_data)
        
        # Extract tables using pdfplumber
        tables = extract_tables_from_pdf(pdf_bytes)
        
        if not tables:
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'error': 'No tables found in the PDF',
                    'tables': []
                })
            }

        # Create Excel file
        excel_data = create_excel_file(tables)
        excel_base64 = base64.b64encode(excel_data).decode('utf-8')

        # Prepare response
        response = {
            'success': True,
            'tables': tables,
            'excel_data': excel_base64,
            'message': f'Successfully extracted {len(tables)} table(s) from {filename}'
        }

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(response)
        }

    except Exception as e:
        error_msg = f"Error processing PDF: {str(e)}"
        print(f"Error: {error_msg}")
        print(f"Traceback: {traceback.format_exc()}")
        
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'success': False,
                'error': error_msg,
                'tables': []
            })
        }

def extract_tables_from_pdf(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """Extract all tables from PDF using pdfplumber"""
    tables = []
    
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            # Extract tables from this page
            page_tables = page.extract_tables()
            
            for table_num, table in enumerate(page_tables, 1):
                if table and len(table) > 0:
                    # Clean up the table data
                    cleaned_table = []
                    for row in table:
                        if row:  # Skip empty rows
                            cleaned_row = []
                            for cell in row:
                                if cell is not None:
                                    cleaned_row.append(str(cell).strip())
                                else:
                                    cleaned_row.append('')
                            cleaned_table.append(cleaned_row)
                    
                    if cleaned_table:
                        tables.append({
                            'page_number': page_num,
                            'table_number': table_num,
                            'data': cleaned_table,
                            'rows': len(cleaned_table),
                            'columns': len(cleaned_table[0]) if cleaned_table else 0
                        })
    
    return tables

def create_excel_file(tables: List[Dict[str, Any]]) -> bytes:
    """Create Excel file with all tables as separate sheets"""
    excel_buffer = io.BytesIO()
    
    with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
        for i, table in enumerate(tables, 1):
            # Convert table data to DataFrame
            df = pd.DataFrame(table['data'])
            
            # Use the first row as headers if it looks like headers
            if len(df) > 1:
                # Check if first row looks like headers (non-numeric, different from second row)
                first_row = df.iloc[0]
                second_row = df.iloc[1] if len(df) > 1 else None
                
                # If first row is different from second row, use it as header
                if second_row is not None and not first_row.equals(second_row):
                    df.columns = first_row
                    df = df.drop(df.index[0])
            
            # Write to Excel sheet
            sheet_name = f"Table_{i}"
            df.to_excel(writer, sheet_name=sheet_name, index=False)
    
    excel_buffer.seek(0)
    return excel_buffer.getvalue()
