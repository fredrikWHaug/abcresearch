/**
 * Graph Code Executor Component
 * 
 * Auto-executes Python code and displays the graph, with collapsible code view
 */

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Play, Loader2, Image as ImageIcon, Code, ChevronDown, ChevronUp } from 'lucide-react'
import { pyodideRenderer } from '@/services/pyodideGraphRenderer'

interface GraphCodeExecutorProps {
  code: string
  title?: string
}

export function GraphCodeExecutor({ code, title = 'Efficacy Comparison Graph' }: GraphCodeExecutorProps) {
  const [isExecuting, setIsExecuting] = useState(true) // Start in executing state
  const [renderedImage, setRenderedImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [executionTime, setExecutionTime] = useState<number | null>(null)
  const [showCode, setShowCode] = useState(false) // Code collapsed by default

  const handleExecuteCode = async () => {
    setIsExecuting(true)
    setError(null)
    
    try {
      const result = await pyodideRenderer.renderGraph(code)
      
      if (result.success && result.imageDataUrl) {
        setRenderedImage(result.imageDataUrl)
        setExecutionTime(result.executionTimeMs || 0)
      } else {
        setError(result.error || 'Failed to render graph')
      }
    } catch (err) {
      console.error('Error executing graph code:', err)
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsExecuting(false)
    }
  }

  // Auto-execute on mount
  useEffect(() => {
    handleExecuteCode()
  }, [code]) // Re-execute if code changes

  return (
    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-200">
              <svg className="w-5 h-5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-purple-900">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowCode(!showCode)}
              variant="outline"
              size="sm"
            >
              <Code className="h-4 w-4 mr-2" />
              {showCode ? 'Hide Code' : 'View Code'}
              {showCode ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
            </Button>
            {renderedImage && (
              <Button
                onClick={handleExecuteCode}
                disabled={isExecuting}
                size="sm"
                variant="outline"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Re-rendering...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Re-run
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isExecuting && !renderedImage && (
        <div className="p-8 bg-gray-50 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mb-4" />
          <p className="text-sm text-gray-600 mb-1">Rendering graph...</p>
          <p className="text-xs text-gray-500">First run may take 10-15 seconds to load Python environment</p>
        </div>
      )}

      {/* Rendered Graph - Show First */}
      {renderedImage && renderedImage.length > 0 && (
        <div className="p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <ImageIcon className="h-4 w-4" />
              <span>Graph Output</span>
              {executionTime && (
                <span className="text-xs text-gray-500">
                  (rendered in {(executionTime / 1000).toFixed(2)}s)
                </span>
              )}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <img 
              src={renderedImage} 
              alt={title}
              className="max-w-full h-auto mx-auto"
              style={{ maxHeight: '600px' }}
            />
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border-t border-red-200">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Failed to render graph</p>
              <p className="text-xs text-red-700 mt-1">{error}</p>
              <Button
                onClick={handleExecuteCode}
                disabled={isExecuting}
                size="sm"
                variant="outline"
                className="mt-2"
              >
                <Play className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Python Code - Collapsible */}
      {showCode && (
        <div className="border-t border-gray-200">
          <div className="bg-gray-900 p-4 overflow-x-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 font-mono">Python Code</span>
            </div>
            <pre className="text-sm text-gray-100 font-mono">
              <code>{code}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

