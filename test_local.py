#!/usr/bin/env python3
"""
Local test script for the PDF extraction API
Run this to test the Python API locally before deploying to Vercel
"""

import json
import base64
import sys
from api.extract_tables import handler

class MockRequest:
    def __init__(self, method='POST', body=None, json_data=None):
        self.method = method
        self.body = body
        self.json = json_data

def test_pdf_extraction():
    """Test the PDF extraction with a sample PDF"""
    
    # You can replace this with a path to a test PDF file
    test_pdf_path = input("Enter path to test PDF file (or press Enter to skip): ").strip()
    
    if not test_pdf_path:
        print("No PDF file provided. Testing with mock data...")
        # Test with mock data
        mock_data = {
            'pdf_data': 'dGVzdA==',  # base64 for "test"
            'filename': 'test.pdf'
        }
        
        request = MockRequest(json_data=mock_data)
        response = handler(request)
        
        print("Response:")
        print(json.dumps(response, indent=2))
        return
    
    try:
        # Read and encode PDF file
        with open(test_pdf_path, 'rb') as f:
            pdf_bytes = f.read()
            pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        # Create mock request
        mock_data = {
            'pdf_data': pdf_base64,
            'filename': test_pdf_path.split('/')[-1]
        }
        
        request = MockRequest(json_data=mock_data)
        response = handler(request)
        
        print("Response:")
        print(json.dumps(response, indent=2))
        
        if response['statusCode'] == 200:
            result = json.loads(response['body'])
            if result.get('success'):
                print(f"\n✅ Success! Extracted {len(result.get('tables', []))} tables")
                print(f"Excel data size: {len(result.get('excel_data', ''))} characters")
            else:
                print(f"\n❌ Failed: {result.get('error')}")
        else:
            print(f"\n❌ HTTP Error: {response['statusCode']}")
            
    except FileNotFoundError:
        print(f"❌ File not found: {test_pdf_path}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🧪 Testing PDF Extraction API Locally")
    print("=" * 40)
    test_pdf_extraction()
