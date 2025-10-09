#!/usr/bin/env node
/**
 * Debug script to test the enhance-search API directly
 * Run with: node debug-api.js
 */

async function testEnhanceSearchAPI() {
  console.log('🧪 Testing Enhance Search API');
  console.log('=' .repeat(50));
  
  const testQuery = 'Phase 3 cancer trials by Pfizer';
  console.log('📝 Test query:', testQuery);
  
  try {
    const response = await fetch('http://localhost:5173/api/enhance-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: testQuery
      })
    });
    
    console.log('📥 Response status:', response.status);
    console.log('📥 Response ok:', response.ok);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📥 Raw response:', responseText);
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('✅ Parsed response:', JSON.stringify(data, null, 2));
      } catch (parseError) {
        console.error('❌ Failed to parse JSON:', parseError);
      }
    } else {
      console.error('❌ Request failed with status:', response.status);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('❌ Stack:', error.stack);
  }
}

// Check if we're running this script directly
if (require.main === module) {
  testEnhanceSearchAPI();
}

module.exports = { testEnhanceSearchAPI };
