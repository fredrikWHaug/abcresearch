#!/usr/bin/env python3
"""
Test script for the Supabase Edge Function
This tests the complete flow: Frontend -> Edge Function -> Python API
"""

import requests
import base64
import json
import sys

def test_edge_function(pdf_path, edge_function_url, python_api_url):
    """Test the complete PDF extraction flow"""
    
    try:
        # Read PDF file
        with open(pdf_path, 'rb') as f:
            pdf_bytes = f.read()
        
        # Test Python API directly first
        print("🧪 Testing Python API directly...")
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        python_response = requests.post(python_api_url, json={
            'pdf_data': pdf_base64,
            'filename': pdf_path.split('/')[-1]
        })
        
        if python_response.status_code == 200:
            result = python_response.json()
            if result.get('success'):
                print(f"✅ Python API works! Extracted {len(result.get('tables', []))} tables")
            else:
                print(f"❌ Python API failed: {result.get('error')}")
                return False
        else:
            print(f"❌ Python API HTTP error: {python_response.status_code}")
            return False
        
        # Test Edge Function
        print("\n🧪 Testing Edge Function...")
        
        # Create form data for Edge Function
        files = {'file': (pdf_path.split('/')[-1], pdf_bytes, 'application/pdf')}
        headers = {'Authorization': 'Bearer test-token'}  # You may need a real token
        
        edge_response = requests.post(edge_function_url, files=files, headers=headers)
        
        if edge_response.status_code == 200:
            result = edge_response.json()
            if result.get('success'):
                print(f"✅ Edge Function works! Extracted {len(result.get('tables', []))} tables")
                print(f"📊 Excel data size: {len(result.get('excel_data', ''))} characters")
                return True
            else:
                print(f"❌ Edge Function failed: {result.get('error')}")
                return False
        else:
            print(f"❌ Edge Function HTTP error: {edge_response.status_code}")
            print(f"Response: {edge_response.text}")
            return False
            
    except FileNotFoundError:
        print(f"❌ File not found: {pdf_path}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    print("🧪 Testing PDF Extraction System")
    print("=" * 40)
    
    # Get PDF file path
    pdf_path = input("Enter path to test PDF file: ").strip()
    if not pdf_path:
        print("❌ No PDF file provided")
        return
    
    # URLs for testing
    python_api_url = "http://localhost:3000/api/extract_tables"
    edge_function_url = input("Enter Edge Function URL (or press Enter for local): ").strip()
    
    if not edge_function_url:
        print("⚠️  You need to provide the Edge Function URL for testing")
        print("   Get it from: supabase functions serve extract-pdf-tables")
        return
    
    # Run tests
    success = test_edge_function(pdf_path, edge_function_url, python_api_url)
    
    if success:
        print("\n🎉 All tests passed!")
    else:
        print("\n❌ Tests failed. Check the errors above.")

if __name__ == "__main__":
    main()
