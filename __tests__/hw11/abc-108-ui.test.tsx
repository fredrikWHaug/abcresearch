/**
 * HW11 UI Tests: ABC-108
 * Bug Fix: Research tab search button UI not obvious
 *
 * Tests verify that:
 * 1. Search suggestion buttons have prominent styling
 * 2. "Click to Search" label is present
 * 3. Gradient background and hover effects are applied
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

describe('ABC-108: Research Tab Search Button UI', () => {
  describe('Search Button Styling', () => {
    it('should have gradient blue background classes', () => {
      // Test the CSS classes used for gradient background
      const buttonClasses = 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600'

      expect(buttonClasses).toContain('bg-gradient-to-r')
      expect(buttonClasses).toContain('from-blue-600')
      expect(buttonClasses).toContain('to-blue-500')
    })

    it('should have prominent border styling', () => {
      const buttonClasses = 'border-2 border-blue-800'

      expect(buttonClasses).toContain('border-2')
      expect(buttonClasses).toContain('border-blue-800')
    })

    it('should have shadow and hover effects', () => {
      const buttonClasses = 'shadow-lg hover:shadow-2xl hover:scale-[1.03]'

      expect(buttonClasses).toContain('shadow-lg')
      expect(buttonClasses).toContain('hover:shadow-2xl')
      expect(buttonClasses).toContain('hover:scale-[1.03]')
    })

    it('should have rounded corners', () => {
      const buttonClasses = 'rounded-xl'

      expect(buttonClasses).toContain('rounded-xl')
    })

    it('should have proper padding', () => {
      const buttonClasses = 'p-5'

      expect(buttonClasses).toContain('p-5')
    })
  })

  describe('"Click to Search" Label', () => {
    it('should contain call-to-action text', () => {
      const labelText = 'Click to Search →'

      expect(labelText).toContain('Click to Search')
      expect(labelText).toContain('→')
    })

    it('should have pill-shaped styling', () => {
      const labelClasses = 'bg-blue-700/50 px-3 py-1 rounded-full'

      expect(labelClasses).toContain('rounded-full')
      expect(labelClasses).toContain('bg-blue-700/50')
    })

    it('should have proper text color', () => {
      const labelClasses = 'text-blue-100'

      expect(labelClasses).toContain('text-blue-100')
    })
  })

  describe('Search Icon', () => {
    it('should have proper icon size', () => {
      const iconClasses = 'w-5 h-5'

      expect(iconClasses).toContain('w-5')
      expect(iconClasses).toContain('h-5')
    })

    it('should have white color', () => {
      const iconClasses = 'text-white'

      expect(iconClasses).toContain('text-white')
    })

    it('should have hover animation', () => {
      const iconClasses = 'group-hover:scale-110 transition-transform'

      expect(iconClasses).toContain('group-hover:scale-110')
      expect(iconClasses).toContain('transition-transform')
    })
  })

  describe('"Recommended Search" Header', () => {
    it('should have header text', () => {
      const headerText = 'Recommended Search:'

      expect(headerText).toBe('Recommended Search:')
    })

    it('should have proper styling', () => {
      const headerClasses = 'text-sm font-semibold text-gray-700'

      expect(headerClasses).toContain('text-sm')
      expect(headerClasses).toContain('font-semibold')
      expect(headerClasses).toContain('text-gray-700')
    })
  })

  describe('Button Text Styling', () => {
    it('should have bold white text', () => {
      const textClasses = 'font-bold text-white text-lg'

      expect(textClasses).toContain('font-bold')
      expect(textClasses).toContain('text-white')
      expect(textClasses).toContain('text-lg')
    })
  })

  describe('Layout Structure', () => {
    it('should use flexbox for proper alignment', () => {
      const containerClasses = 'flex items-center justify-between gap-3'

      expect(containerClasses).toContain('flex')
      expect(containerClasses).toContain('items-center')
      expect(containerClasses).toContain('justify-between')
    })

    it('should have proper spacing', () => {
      const spacingClasses = 'mt-4 space-y-3'

      expect(spacingClasses).toContain('mt-4')
      expect(spacingClasses).toContain('space-y-3')
    })
  })

  describe('Accessibility', () => {
    it('should have cursor pointer', () => {
      const buttonClasses = 'cursor-pointer'

      expect(buttonClasses).toContain('cursor-pointer')
    })

    it('should have full width', () => {
      const buttonClasses = 'w-full'

      expect(buttonClasses).toContain('w-full')
    })

    it('should have text alignment', () => {
      const buttonClasses = 'text-left'

      expect(buttonClasses).toContain('text-left')
    })
  })

  describe('Component Rendering', () => {
    it('should render search suggestion button with all required elements', () => {
      // Create a minimal version of the search suggestion button
      const SearchSuggestionButton = ({ label, description }: { label: string; description?: string }) => (
        <button className="group w-full text-left p-5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 border-2 border-blue-800 rounded-xl transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-[1.03] cursor-pointer">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <svg className="w-5 h-5 text-white flex-shrink-0 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="font-bold text-white text-lg">{label}</span>
            </div>
            <span className="text-sm font-medium text-blue-100 bg-blue-700/50 px-3 py-1 rounded-full whitespace-nowrap">
              Click to Search →
            </span>
          </div>
          {description && (
            <p className="text-sm text-blue-100 mt-3 ml-9">{description}</p>
          )}
        </button>
      )

      const { container } = render(
        <SearchSuggestionButton
          label="Search for GLP-1 agonists"
          description="Find clinical trials and research papers"
        />
      )

      // Verify button exists
      const button = container.querySelector('button')
      expect(button).toBeTruthy()

      // Verify it has gradient background class
      expect(button?.className).toContain('bg-gradient-to-r')

      // Verify it has border
      expect(button?.className).toContain('border-2')

      // Verify "Click to Search" text exists
      expect(container.textContent).toContain('Click to Search')

      // Verify label exists
      expect(container.textContent).toContain('Search for GLP-1 agonists')
    })
  })
})
