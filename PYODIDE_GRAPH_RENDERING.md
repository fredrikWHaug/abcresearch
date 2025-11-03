# Pyodide Graph Rendering Feature

## Overview

This feature allows users to render GPT-generated Python matplotlib code directly in the browser using Pyodide (WebAssembly Python runtime). Users can see AI-reconstructed graphs without needing a local Python installation.

## What Was Implemented

### 1. New Service: `pyodideGraphRenderer.ts`
- **Location**: `src/services/pyodideGraphRenderer.ts`
- **Purpose**: Manages Pyodide initialization and executes Python code
- **Key Features**:
  - Lazy loading of Pyodide (~50MB) from CDN
  - Loads matplotlib and numpy automatically
  - Executes GPT-generated Python code to produce PNG images
  - Caches initialization (first load: 10-15s, subsequent: instant)
  - Error handling and execution time tracking

### 2. Updated Types: `extraction.ts`
- **Location**: `src/types/extraction.ts`
- **Changes**: Added optional fields to `GraphifyResult`:
  - `renderedImage?: string` - Base64 data URL of rendered graph
  - `renderError?: string` - Error message if rendering fails
  - `renderTimeMs?: number` - Execution time for debugging

### 3. Updated UI: `PaperAnalysisView.tsx`
- **Location**: `src/components/PaperAnalysisView.tsx`
- **New Features**:
  - "Render Graph in Browser" button for each graph with Python code
  - Loading state during Pyodide initialization
  - Display of AI-reconstructed graph with zoom/pan controls
  - Error handling UI if rendering fails
  - Progressive enhancement (original image always shown)

## How to Use

### For Users

1. **Upload a PDF** with graphs to the Data Extraction page
2. **Enable graph detection** (default: on)
3. **Extract content** - wait for processing
4. **View Comprehensive Analysis**
5. **Navigate to Graphs tab**
6. **Find graphs with Python code** (detected graphs only)
7. **Click "Render Graph in Browser"**
   - First time: Wait 10-15 seconds for Python environment to load
   - Subsequent clicks: Instant rendering
8. **Compare** the AI-reconstructed graph with the original image
9. **Zoom/pan** to inspect details

### For Developers

#### Running Locally

```bash
# Install dependencies (Pyodide is now included)
npm install

# Start dev server
npm run dev

# Navigate to http://localhost:5173
```

#### Testing the Feature

1. **Prepare a test PDF**:
   - Find a research paper with line charts, bar charts, or scatter plots
   - Ensure the graphs are clear and data-driven (not photos/diagrams)

2. **Upload and Extract**:
   ```
   Upload PDF → Enable graph detection → Extract Content
   ```

3. **View Analysis**:
   - Click "View Comprehensive Analysis"
   - Go to "Graphs" tab
   - Find graphs marked with "Graph Detected" badge

4. **Test Rendering**:
   - Click "Render Graph in Browser" button
   - Wait for Pyodide initialization (first time only)
   - Verify the rendered graph appears below the Python code
   - Check that zoom/pan controls work

5. **Test Edge Cases**:
   - Try rendering multiple graphs in succession
   - Test with graphs that might have complex Python code
   - Verify error handling if code fails to execute

## Architecture

```
User clicks "Render Graph"
    ↓
Check if Pyodide initialized
    ↓ (first time)
Download Pyodide from CDN (~50MB)
Load matplotlib + numpy (~20s)
    ↓
Execute GPT Python code
    ↓
Capture matplotlib figure as PNG
    ↓
Convert to base64 data URL
    ↓
Display in UI with zoom/pan controls
```

## Performance Characteristics

- **First render**: 10-15 seconds (Pyodide download + initialization)
- **Subsequent renders**: < 1 second (instant execution)
- **Bundle size impact**: ~0 bytes (Pyodide loaded from CDN on demand)
- **Memory usage**: ~50-100MB (browser memory for Pyodide)
- **Caching**: Pyodide packages cached by browser

## Browser Compatibility

- ✅ Chrome/Edge (90+)
- ✅ Firefox (90+)
- ✅ Safari (15.4+)
- ⚠️ Mobile browsers (works but slower, high memory usage)

## Limitations

1. **First Load Time**: 10-15 seconds for Pyodide initialization
2. **Memory Usage**: ~50-100MB in browser memory
3. **Code Execution**: Only executes Python code (no external files/APIs)
4. **Matplotlib Features**: Limited to what Pyodide's matplotlib supports
5. **Mobile Performance**: May be slow on low-end devices

## Troubleshooting

### "Failed to initialize Pyodide"
- **Cause**: Network issues or CDN unavailable
- **Solution**: Check internet connection, try refreshing the page

### "Failed to render graph"
- **Cause**: Python code has errors or uses unsupported features
- **Solution**: Download the Python code and run locally for debugging

### "Loading is very slow"
- **Cause**: Slow internet connection or first-time load
- **Solution**: Wait for initial load; subsequent renders will be instant

### Graph looks different from original
- **Cause**: GPT approximated data points or made assumptions
- **Solution**: Check the "Assumptions" section; GPT notes ambiguous data

## Future Enhancements

Potential improvements:
- Pre-initialize Pyodide in background on page load
- Service worker caching for offline usage
- Support for more Python plotting libraries (seaborn, plotly)
- Export rendered graphs as high-resolution images
- Side-by-side comparison view (original vs. reconstructed)

## Technical Details

### Pyodide Version
- Version: 0.29.0
- Packages: matplotlib, numpy
- CDN: jsDelivr

### Python Code Wrapping
The service wraps GPT code to:
1. Set matplotlib backend to 'Agg' (non-GUI)
2. Clear previous plots
3. Execute user code
4. Find and call the plotting function (recreate_plot, create_plot, etc.)
5. Save to virtual filesystem
6. Convert to base64

### Error Handling
- Network errors during Pyodide download
- Python syntax errors in GPT code
- Missing dependencies in code
- Execution timeouts (not implemented yet)

## Dependencies

```json
{
  "pyodide": "^0.25.0"
}
```

No additional dependencies needed - Pyodide is self-contained.

## Related Files

- `src/services/pyodideGraphRenderer.ts` - Core rendering service
- `src/components/PaperAnalysisView.tsx` - UI integration
- `src/types/extraction.ts` - Type definitions
- `api/extract-pdf-content.ts` - Backend GPT integration (generates Python code)

## Questions?

For issues or questions:
1. Check browser console for detailed error messages
2. Review the Python code for syntax errors
3. Test with a simpler graph first
4. Fall back to downloading and running code locally

