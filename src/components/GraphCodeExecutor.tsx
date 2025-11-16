/**
 * Graph Code Executor Component
 * 
 * Displays Python code for graphs and allows execution with Pyodide
 */

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Play, Loader2, Image as ImageIcon } from 'lucide-react'
import { pyodideRenderer } from '@/services/pyodideGraphRenderer'

interface GraphCodeExecutorProps {
  code: string
  title?: string
}

export function GraphCodeExecutor({ code, title = 'Efficacy Comparison Graph' }: GraphCodeExecutorProps) {
  const [isExecuting, setIsExecuting] = useState(false)
  const [renderedImage, setRenderedImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [executionTime, setExecutionTime] = useState<number | null>(null)

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
          <Button
            onClick={handleExecuteCode}
            disabled={isExecuting}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Rendering...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Code
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Python Code */}
      <div className="bg-gray-900 p-4 overflow-x-auto">
        <pre className="text-sm text-gray-100 font-mono">
          <code>{code}</code>
        </pre>
      </div>

      {/* Rendered Graph */}
      {renderedImage && renderedImage.length > 0 && (
        <div className="p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <ImageIcon className="h-4 w-4" />
              <span>Rendered Graph</span>
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
            </div>
          </div>
        </div>
      )}

      {/* Initial State Help */}
      {!renderedImage && !error && !isExecuting && (
        <div className="p-4 bg-blue-50 border-t border-blue-200">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-blue-900">
                Click "Run Code" to execute this Python code and visualize the graph in your browser.
              </p>
              <p className="text-xs text-blue-700 mt-1">
                First run may take 10-15 seconds to load the Python environment. Subsequent runs are instant.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

