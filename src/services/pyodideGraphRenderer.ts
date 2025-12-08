 
/**
 * Pyodide Graph Renderer Service
 * 
 * Executes GPT-generated Python matplotlib code in the browser using Pyodide (WebAssembly Python runtime).
 * This allows users to see AI-reconstructed graphs directly in the browser without needing a Python installation.
 * 
 * Performance Notes:
 * - First initialization takes 5-15 seconds (downloads ~50MB of packages)
 * - Subsequent renders are fast (< 1 second)
 * - Uses CDN caching for better performance
 */

import { loadPyodide, type PyodideInterface } from 'pyodide'

export interface RenderResult {
  success: boolean
  imageDataUrl?: string
  error?: string
  executionTimeMs: number
}

class PyodideGraphRenderer {
  private pyodide: PyodideInterface | null = null
  private isInitialized = false
  private initializationPromise: Promise<void> | null = null

  /**
   * Initialize Pyodide with matplotlib and numpy
   * This is expensive (~5-15 seconds) but only happens once per session
   */
  async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.isInitialized) {
      return
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    // Start initialization
    this.initializationPromise = this._doInitialize()
    return this.initializationPromise
  }

  private async _doInitialize(): Promise<void> {
    try {
      // Load Pyodide from CDN
      // Note: The version should match the installed pyodide package version
      this.pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/'
      })

      // Load required packages (pandas depends on numpy, so load numpy first)
      await this.pyodide.loadPackage(['matplotlib', 'numpy', 'pandas'])

      // Configure matplotlib for non-interactive backend
      await this.pyodide.runPythonAsync(`
import matplotlib
matplotlib.use('Agg')  # Non-GUI backend for image generation
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from io import StringIO
import io
import base64

print("Matplotlib, numpy, and pandas ready")
`)

      this.isInitialized = true
    } catch (error) {
      console.error('[Pyodide] Initialization failed:', error)
      this.isInitialized = false
      this.initializationPromise = null
      throw new Error(`Failed to initialize Pyodide: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if Pyodide is ready to use
   */
  isReady(): boolean {
    return this.isInitialized
  }

  /**
   * Render a graph from GPT-generated Python code
   * @param pythonCode - The Python code that generates a matplotlib plot
   * @returns RenderResult with base64-encoded PNG image data URL
   */
  async renderGraph(pythonCode: string): Promise<RenderResult> {
    const startTime = Date.now()

    try {
      // Ensure Pyodide is initialized
      if (!this.isInitialized) {
        await this.initialize()
      }

      if (!this.pyodide) {
        throw new Error('Pyodide not initialized')
      }

      // Wrap the GPT-generated code to capture output as PNG
      // The GPT code should define a recreate_plot() function or similar
      const wrappedCode = `
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from io import StringIO
import io
import base64

# Clear any previous plots
plt.clf()
plt.close('all')

# Execute the GPT-generated code
${pythonCode}

# Try to find and call the plotting function
# GPT usually names it recreate_plot or similar
import tempfile
import os

# Create a temporary file path (Pyodide has a virtual filesystem)
output_path = '/tmp/plot.png'

# Try common function names
plot_function = None
if 'recreate_plot' in dir():
    plot_function = recreate_plot
elif 'create_plot' in dir():
    plot_function = create_plot
elif 'plot' in dir() and callable(plot):
    plot_function = plot
elif 'main' in dir() and callable(main):
    plot_function = main

if plot_function:
    # Call the plotting function
    plot_function(output_path)
else:
    # If no function found, assume the code already generated a plot
    # Just save the current figure
    plt.savefig(output_path, format='png', dpi=150, bbox_inches='tight')

# Read the saved file and convert to base64
with open(output_path, 'rb') as f:
    img_bytes = f.read()
    img_base64 = base64.b64encode(img_bytes).decode('utf-8')

# Clean up
if os.path.exists(output_path):
    os.remove(output_path)

# Return the base64 string
img_base64
`

      // Execute the code
      const result = await this.pyodide.runPythonAsync(wrappedCode)

      if (!result || typeof result !== 'string') {
        throw new Error('Python code did not return a valid image')
      }

      const executionTimeMs = Date.now() - startTime

      return {
        success: true,
        imageDataUrl: `data:image/png;base64,${result}`,
        executionTimeMs
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime
      console.error('[Pyodide] Execution failed:', error)
      
      // Extract meaningful error message
      let errorMessage = 'Unknown error'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }

      return {
        success: false,
        error: errorMessage,
        executionTimeMs
      }
    }
  }

  /**
   * Get initialization progress message for UI display
   */
  getInitStatus(): { isInitialized: boolean; message: string } {
    if (this.isInitialized) {
      return { isInitialized: true, message: 'Python environment ready' }
    } else if (this.initializationPromise) {
      return { isInitialized: false, message: 'Loading Python environment (first time: ~10-15 seconds)...' }
    } else {
      return { isInitialized: false, message: 'Python environment not loaded' }
    }
  }

  /**
   * Pre-load Pyodide in the background (optional optimization)
   */
  async preload(): Promise<void> {
    if (!this.isInitialized && !this.initializationPromise) {
      // Start initialization but don't wait for it
      this.initialize().catch(err => {
        console.error('[Pyodide] Pre-load failed:', err)
      })
    }
  }
}

// Singleton instance
export const pyodideRenderer = new PyodideGraphRenderer()

