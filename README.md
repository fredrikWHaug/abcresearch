## Datalab Marker CLI — PDF → Markdown and JSON

This repository includes a small CLI to convert PDFs into Markdown (and optional structured JSON) using Datalab's Marker API. It uploads a PDF, polls for completion, and saves results locally for review and downstream processing.

Reference: see Datalab's API docs: [API Overview](https://documentation.datalab.to/docs/welcome/api).

### Prerequisites
- Python 3.8+
- Install dependencies:

```bash
python3 -m pip install --upgrade pip
python3 -m pip install requests
```

- Datalab API key: set an environment variable (preferred) or pass via CLI

```bash
export DATALAB_API_KEY=YOUR_API_KEY
# or pass --api-key YOUR_API_KEY to the command below
```

### Quick start
Basic conversion to Markdown, saving outputs alongside the input PDF under `datalab_outputs/`:

```bash
python3 /Users/bozhenpeng/GitHub/abcresearch/scripts/datalab_marker.py \
  "/Users/bozhenpeng/GitHub/abcresearch/JACC-Interplay of Chronic Kidney Disease and the Effects of Tirzepatide in Patients With Heart Failure, Preserved Ejection Fraction, and Obesity (1).pdf"
```

With structured extraction using a schema (JSON). This attempts to save an additional `-extractions.json` if the API returns structured data:

```bash
python3 /Users/bozhenpeng/GitHub/abcresearch/scripts/datalab_marker.py \
  "/absolute/path/to/input.pdf" \
  --schema-file "/absolute/path/to/page_schema.json"
```

Write outputs to a specific directory and override the base name:

```bash
python3 /Users/bozhenpeng/GitHub/abcresearch/scripts/datalab_marker.py \
  "/absolute/path/to/input.pdf" \
  --out-dir "/absolute/path/to/out" \
  --name "my-run-001"
```

### What gets saved
- Markdown: `datalab_outputs/<stem>.md`
- Full API response: `datalab_outputs/<stem>-response.json`
- Structured extraction (when `--schema-file` is provided and present in response): `datalab_outputs/<stem>-extractions.json`
- Images: decoded images under `datalab_outputs/<stem>_images/` when available, and a `image_urls.txt` for any images returned as URLs

These paths are created under the PDF's directory by default, or under `--out-dir` if provided.

### CLI options (common)
- `--api-key`: Datalab API key (otherwise reads `DATALAB_API_KEY`)
- `--out-dir`: Directory to write outputs
- `--name`: Base name for output files (defaults to input file stem)
- `--schema-file`: Path to a JSON schema for structured extraction (sends as `page_schema`)
- `--force-ocr`: Force OCR
- `--paginate`: Paginate output
- `--use-llm true|false`: Explicitly set `use_llm` (auto-enabled when `--schema-file` is provided if not set)
- `--strip-existing-ocr`: Strip any existing OCR
- `--disable-image-extraction`: Disable image extraction
- `--timeout-s`: Max seconds to wait for completion (default 900)
- `--poll-interval-s`: Polling interval in seconds (default 2.0)
- `--no-save-images`: Do not save images from response

Full help:

```bash
python3 /Users/bozhenpeng/GitHub/abcresearch/scripts/datalab_marker.py --help
```

### Example page schema
Create a schema file (e.g., `/absolute/path/to/page_schema.json`) to request specific fields. The contents depend on your use case. Example:

```json
{
  "fields": [
    { "name": "title", "type": "string" },
    { "name": "abstract", "type": "string" },
    { "name": "authors", "type": "array" },
    { "name": "keywords", "type": "array" }
  ]
}
```

Pass the file via `--schema-file` and the script will send it as `page_schema`. If the API returns structured results (e.g., under keys like `json`, `structured_output`, etc.), they will be saved to `<stem>-extractions.json` for convenience.

### Notes and troubleshooting
- Ensure the API key is set; otherwise you'll see: "Missing API key...". Set `DATALAB_API_KEY` or pass `--api-key`.
- For very large PDFs, consider increasing `--timeout-s` or `--poll-interval-s`.
- If the job fails, check `<stem>-response.json` for `error` details.
- You can disable image saving with `--no-save-images` if you only need text outputs.

## Graphify — classify and reconstruct graphs with GPT

After extraction, you can send saved images to a GPT vision model to detect which ones are graphs and reconstruct them into editable Python code and regenerated images.

### Prerequisites for graphify
- Set a GPT API key and optionally API base/model:

```bash
export GPT_API_KEY=YOUR_GPT_KEY
# optional overrides:
# export GPT_API_BASE=https://api.openai.com/v1
# export GPT_MODEL=gpt-5-mini
```

### Use graphify standalone

```bash
python3 /Users/bozhenpeng/GitHub/abcresearch/scripts/graphify_images.py \
  "/path/to/datalab_outputs/<stem>_images" \
  --execute
```

This saves per-image JSON with `is_graph`, `graph_type`, `python_code`, etc., and optionally reconstructs images as `<stem>.reconstructed.png`. A `summary.json` is created for quick review.

### One-step workflow (extract + graphify)
Run Datalab extraction and then graphify in one command by enabling `--graphify`:

```bash
python3 /Users/bozhenpeng/GitHub/abcresearch/scripts/datalab_marker.py \
  "/absolute/path/to/input.pdf" \
  --graphify \
  --graphify-execute \
  --out-dir "/Users/bozhenpeng/GitHub/abcresearch/out"
```

Options to tune graphify from the combined command:
- `--graphify-api-key`: GPT API key (or set `GPT_API_KEY`/`OPENAI_API_KEY`)
- `--graphify-api-base`: GPT API base (or `GPT_API_BASE`/`OPENAI_API_BASE`)
- `--graphify-model`: Model name (or `GPT_MODEL`; default `gpt-5-mini`)
- `--graphify-max-images N`: Cap images processed
- `--graphify-context`: Extra text context for classification/extraction
- `--graphify-out-dir`: Output directory for graphify results (default: `<images_dir>_graphify`)
 - Reliability and speed: use `graphify_images.py --timeout-s 90 --concurrency 3` (or via one-step, set env `GPT_MODEL`, images count, etc.)

Notes:
- `--graphify-execute` runs the generated Python to recreate plots. Requires `matplotlib`.
- Without `--graphify-execute`, only JSON descriptions and code are saved.

### Installing optional dependencies

```bash
python3 -m pip install matplotlib
```

### Caveats
- The GPT model infers approximate data when precise values aren’t legible. Check `assumptions` in output JSON.
- If Datalab returns only image URLs (not inlined), download images first or place them in the images directory before running graphify.


