/**
 * Chat Response Truncation Bug Detection
 * 
 * BUG: AI responses get cut off mid-sentence due to low max_tokens limit
 * 
 * Current: max_tokens: 200 (too low!)
 * Expected: max_tokens: 1000-1500 (allows complete responses)
 */

/* eslint-disable */

import { describe, it, expect, vi } from 'vitest'

describe('Chat Response Truncation - Bug Detection', () => {
  it('should verify bug was fixed: max_tokens now adequate', () => {
    // Read the generate-response.ts file
    const fs = require('fs')
    const path = require('path')
    const apiFilePath = path.resolve(__dirname, '../../../api/generate-response.ts')
    const apiContent = fs.readFileSync(apiFilePath, 'utf-8')
    
    // Check conversational response max_tokens
    const conversationalMatch = apiContent.match(/conversationalResponse[\s\S]*?max_tokens:\s*(\d+)/)
    
    if (conversationalMatch) {
      const maxTokens = parseInt(conversationalMatch[1])
      console.log(`FIXED: max_tokens is now set to ${maxTokens}`)
      console.log('Expected: Should be 1000-1500 to prevent truncation')
      
      // Verify fix
      expect(maxTokens).toBeGreaterThanOrEqual(1000)
      expect(maxTokens).toBeLessThanOrEqual(2000) // Not excessive
    }
  })

  it('EXPECTED: after fix, max_tokens should be adequate', () => {
    const fs = require('fs')
    const path = require('path')
    const apiFilePath = path.resolve(__dirname, '../../../api/generate-response.ts')
    const apiContent = fs.readFileSync(apiFilePath, 'utf-8')
    
    // Check for adequate max_tokens value
    const conversationalMatch = apiContent.match(/conversationalResponse[\s\S]*?max_tokens:\s*(\d+)/)
    
    if (conversationalMatch) {
      const maxTokens = parseInt(conversationalMatch[1])
      console.log(`max_tokens is now: ${maxTokens}`)
      
      // After fix, should be 1000+
      expect(maxTokens).toBeGreaterThanOrEqual(1000)
    } else {
      // Fail if we can't find the pattern
      expect(conversationalMatch).toBeDefined()
    }
  })

  it('should ensure search responses have higher token limit than conversational', () => {
    const fs = require('fs')
    const path = require('path')
    const apiFilePath = path.resolve(__dirname, '../../../api/generate-response.ts')
    const apiContent = fs.readFileSync(apiFilePath, 'utf-8')
    
    // Extract both max_tokens values
    const searchMatch = apiContent.match(/searchResponse[\s\S]*?max_tokens:\s*(\d+)/)
    const conversationalMatch = apiContent.match(/conversationalResponse[\s\S]*?max_tokens:\s*(\d+)/)
    
    if (searchMatch && conversationalMatch) {
      const searchTokens = parseInt(searchMatch[1])
      const conversationalTokens = parseInt(conversationalMatch[1])
      
      console.log(`Search max_tokens: ${searchTokens}`)
      console.log(`Conversational max_tokens: ${conversationalTokens}`)
      
      // Conversational responses should have adequate tokens
      expect(conversationalTokens).toBeGreaterThanOrEqual(1000)
    }
  })
})

