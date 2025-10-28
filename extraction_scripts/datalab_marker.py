#!/usr/bin/env python3
"""
CLI for converting PDFs to Markdown (and JSON) using Datalab Marker API.

References:
- Datalab API Overview: https://documentation.datalab.to/docs/welcome/api

This tool:
- Submits a PDF to Datalab Marker API
- Polls until processing is complete
- Saves Markdown output, full JSON response, and any returned images
- Supports optional structured extraction via --schema-file (page_schema)

Environment:
- Requires Python 3.8+
- Requires the 'requests' package: pip install requests
- Reads API key from --api-key or the DATALAB_API_KEY environment variable
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import requests


DEFAULT_MARKER_URL = "https://www.datalab.to/api/v1/marker"


def read_api_key(cmdline_api_key: Optional[str]) -> str:
    api_key = cmdline_api_key or os.getenv("DATALAB_API_KEY")
    if not api_key:
        raise SystemExit(
            "Missing API key. Provide --api-key or set DATALAB_API_KEY environment variable."
        )
    return api_key


def load_schema_file(schema_path: Optional[Path]) -> Optional[str]:
    if not schema_path:
        return None
    try:
        raw = schema_path.read_text(encoding="utf-8")
        # Validate JSON and re-serialize to ensure clean formatting
        parsed = json.loads(raw)
        return json.dumps(parsed, ensure_ascii=False)
    except Exception as exc:
        raise SystemExit(f"Failed to read/parse schema file '{schema_path}': {exc}")


def build_form_data(
    pdf_path: Path,
    output_format: str,
    force_ocr: bool,
    paginate: bool,
    use_llm: Optional[bool],
    strip_existing_ocr: bool,
    disable_image_extraction: bool,
    page_schema_json: Optional[str],
) -> Dict[str, Tuple[Optional[str], Any, Optional[str]]]:
    # Following Datalab docs: multipart/form-data with 'file' and form params
    # Ref: https://documentation.datalab.to/docs/welcome/api
    form: Dict[str, Tuple[Optional[str], Any, Optional[str]]] = {
        "file": (pdf_path.name, pdf_path.open("rb"), "application/pdf"),
        "output_format": (None, output_format, None),
        "force_ocr": (None, str(force_ocr).lower(), None),
        "paginate": (None, str(paginate).lower(), None),
        "strip_existing_ocr": (None, str(strip_existing_ocr).lower(), None),
        "disable_image_extraction": (None, str(disable_image_extraction).lower(), None),
    }
    if use_llm is not None:
        form["use_llm"] = (None, str(use_llm).lower(), None)
    if page_schema_json is not None:
        form["page_schema"] = (None, page_schema_json, None)
    return form


def submit_marker_job(url: str, api_key: str, form_data: Dict[str, Any]) -> Dict[str, Any]:
    headers = {"X-Api-Key": api_key}
    resp = requests.post(url, files=form_data, headers=headers, timeout=300)
    try:
        data = resp.json()
    except Exception:
        resp.raise_for_status()
        # If not JSON, raise a generic error
        raise SystemExit(
            f"Unexpected non-JSON response (HTTP {resp.status_code}). Body: {resp.text[:500]}"
        )

    if resp.status_code >= 400 or not data.get("success", False):
        error_msg = data.get("error") or resp.text
        raise SystemExit(f"Marker submission failed: {error_msg}")
    if not data.get("request_check_url"):
        raise SystemExit("Marker response missing 'request_check_url'.")
    return data


def poll_until_complete(check_url: str, api_key: str, timeout_s: int, poll_interval_s: float) -> Dict[str, Any]:
    headers = {"X-Api-Key": api_key}
    start = time.time()
    last_data: Dict[str, Any] = {}
    while True:
        if time.time() - start > timeout_s:
            raise SystemExit("Timed out waiting for Datalab job to complete.")
        time.sleep(poll_interval_s)
        resp = requests.get(check_url, headers=headers, timeout=120)
        try:
            data = resp.json()
        except Exception:
            resp.raise_for_status()
            raise SystemExit(
                f"Unexpected non-JSON poll response (HTTP {resp.status_code}). Body: {resp.text[:500]}"
            )
        last_data = data

        status = data.get("status")
        if status == "complete":
            break
        if status not in {"complete", "processing", None}:
            # Unknown status: fail fast with diagnostics
            raise SystemExit(f"Unexpected status from Datalab: {status}")

    if not last_data.get("success", False):
        raise SystemExit(f"Datalab job failed: {last_data.get('error', 'Unknown error')}" )
    return last_data


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def safe_stem(path: Path) -> str:
    # Create a filesystem-safe base name
    stem = path.stem
    return "".join(c if c.isalnum() or c in ("-", "_") else "-" for c in stem)


def save_json(obj: Any, out_path: Path) -> None:
    out_path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def try_decode_base64_to_file(content: Any, out_path: Path) -> bool:
    """Attempt to decode various base64 representations to a file.

    Returns True if successfully decoded, else False.
    """
    try:
        if isinstance(content, str):
            # raw base64 string
            data = base64.b64decode(content)
            out_path.write_bytes(data)
            return True
        if isinstance(content, dict):
            # common keys we might see
            for key in ("data", "content", "base64", "b64"):
                if key in content and isinstance(content[key], str):
                    data = base64.b64decode(content[key])
                    out_path.write_bytes(data)
                    return True
    except Exception:
        return False
    return False


def save_images_if_present(response: Dict[str, Any], images_dir: Path) -> Tuple[int, int]:
    images = response.get("images")
    if not images or not isinstance(images, dict):
        return (0, 0)

    ensure_dir(images_dir)
    num_saved = 0
    num_urls = 0
    urls_lines = []

    for key, value in images.items():
        # Determine filename
        if isinstance(value, dict):
            filename = value.get("filename") or str(key)
        else:
            filename = str(key)

        # Heuristically ensure an image extension
        if "." not in filename:
            filename = f"{filename}.png"

        out_path = images_dir / filename

        # Try to decode base64 content if present
        if try_decode_base64_to_file(value, out_path):
            num_saved += 1
            continue

        # If we see a URL, save to a text manifest for later download
        if isinstance(value, dict) and isinstance(value.get("url"), str):
            urls_lines.append(f"{filename}\t{value['url']}")
            num_urls += 1
            continue

        # Unknown format: serialize raw value for debugging
        debug_json = images_dir / f"{Path(filename).stem}.raw.json"
        save_json(value, debug_json)

    if urls_lines:
        (images_dir / "image_urls.txt").write_text("\n".join(urls_lines), encoding="utf-8")

    return (num_saved, num_urls)


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Convert PDF to Markdown (and JSON) via Datalab Marker API."
    )
    parser.add_argument("input", type=str, help="Path to input PDF file")
    parser.add_argument(
        "--api-key",
        type=str,
        default=None,
        help="Datalab API key. If omitted, reads DATALAB_API_KEY env var.",
    )
    parser.add_argument(
        "--endpoint",
        type=str,
        default=DEFAULT_MARKER_URL,
        help="Marker endpoint URL (default: %(default)s)",
    )
    parser.add_argument(
        "--out-dir",
        type=str,
        default=None,
        help="Directory to write outputs. Defaults to alongside the input PDF.",
    )
    parser.add_argument(
        "--name",
        type=str,
        default=None,
        help="Base name for output files (default: input file stem)",
    )
    parser.add_argument(
        "--schema-file",
        type=str,
        default=None,
        help=(
            "Path to a JSON schema file for structured extraction (sent as page_schema). "
            "If provided and --use-llm not set, --use-llm will default to true."
        ),
    )
    parser.add_argument(
        "--output-format",
        type=str,
        default="markdown",
        choices=["markdown"],
        help="Output format requested from Datalab (currently supports 'markdown').",
    )
    parser.add_argument("--force-ocr", action="store_true", help="Force OCR")
    parser.add_argument("--paginate", action="store_true", help="Paginate output")
    parser.add_argument(
        "--use-llm",
        type=str,
        choices=["true", "false"],
        default=None,
        help="Explicitly set use_llm. If omitted, auto-enabled when --schema-file is provided.",
    )
    parser.add_argument(
        "--strip-existing-ocr",
        action="store_true",
        help="Strip any existing OCR from the PDF",
    )
    parser.add_argument(
        "--disable-image-extraction",
        action="store_true",
        help="Disable image extraction",
    )
    parser.add_argument(
        "--timeout-s",
        type=int,
        default=900,
        help="Max seconds to wait for completion (default: %(default)s)",
    )
    parser.add_argument(
        "--poll-interval-s",
        type=float,
        default=2.0,
        help="Polling interval in seconds (default: %(default)s)",
    )
    parser.add_argument(
        "--no-save-images",
        action="store_true",
        help="Do not attempt to save images from the response",
    )

    # Optional: post-process saved images with GPT to detect/reconstruct graphs
    parser.add_argument(
        "--graphify",
        action="store_true",
        help=(
            "Send saved images to a GPT vision model to detect graphs and reconstruct them. "
            "Requires GPT API key via --graphify-api-key or GPT_API_KEY/OPENAI_API_KEY env vars."
        ),
    )
    parser.add_argument(
        "--graphify-execute",
        action="store_true",
        help="Execute generated Python to recreate plots (requires matplotlib)",
    )
    parser.add_argument(
        "--graphify-api-key",
        type=str,
        default=None,
        help="GPT API key (falls back to GPT_API_KEY/OPENAI_API_KEY env)",
    )
    parser.add_argument(
        "--graphify-api-base",
        type=str,
        default=None,
        help="GPT API base URL (falls back to GPT_API_BASE/OPENAI_API_BASE env)",
    )
    parser.add_argument(
        "--graphify-model",
        type=str,
        default=None,
        help="GPT model name (falls back to GPT_MODEL env; default gpt-5-mini)",
    )
    parser.add_argument(
        "--graphify-max-images",
        type=int,
        default=None,
        help="Limit number of images to send to GPT",
    )
    parser.add_argument(
        "--graphify-context",
        type=str,
        default=None,
        help="Extra textual context to help GPT classify/extract",
    )
    parser.add_argument(
        "--graphify-out-dir",
        type=str,
        default=None,
        help="Directory for graphify outputs (default: <images_dir>_graphify)",
    )

    args = parser.parse_args(argv)

    input_path = Path(args.input).expanduser().resolve()
    if not input_path.exists() or not input_path.is_file():
        print(f"Input file not found: {input_path}", file=sys.stderr)
        return 2

    api_key = read_api_key(args.api_key)

    out_dir = Path(args.out_dir).expanduser().resolve() if args.out_dir else input_path.parent / "datalab_outputs"
    ensure_dir(out_dir)

    base_name = args.name or safe_stem(input_path)
    page_schema_json = load_schema_file(Path(args.schema_file).expanduser().resolve()) if args.schema_file else None

    # If schema is provided and use_llm not explicitly set, default to true
    use_llm_opt: Optional[bool]
    if args.use_llm is None and page_schema_json is not None:
        use_llm_opt = True
    elif args.use_llm is None:
        use_llm_opt = None
    else:
        use_llm_opt = args.use_llm.lower() == "true"

    form_data = build_form_data(
        pdf_path=input_path,
        output_format=args.output_format,
        force_ocr=bool(args.force_ocr),
        paginate=bool(args.paginate),
        use_llm=use_llm_opt,
        strip_existing_ocr=bool(args.strip_existing_ocr),
        disable_image_extraction=bool(args.disable_image_extraction),
        page_schema_json=page_schema_json,
    )

    print("Submitting to Datalab Marker...", file=sys.stderr)
    submit_data = submit_marker_job(args.endpoint, api_key, form_data)
    check_url = submit_data["request_check_url"]
    request_id = submit_data.get("request_id") or ""
    print(f"Submitted. Request ID: {request_id}", file=sys.stderr)
    print(f"Polling: {check_url}", file=sys.stderr)

    result = poll_until_complete(
        check_url=check_url,
        api_key=api_key,
        timeout_s=int(args.timeout_s),
        poll_interval_s=float(args.poll_interval_s),
    )

    # Always save the full response JSON for traceability
    response_json_path = out_dir / f"{base_name}-response.json"
    save_json(result, response_json_path)

    # Save Markdown if present
    markdown = result.get("markdown")
    md_path: Optional[Path] = None
    if isinstance(markdown, str) and markdown.strip():
        md_path = out_dir / f"{base_name}.md"
        md_path.write_text(markdown, encoding="utf-8")

    # Attempt to save images if returned
    images_saved = (0, 0)
    if not args.no_save_images:
        images_dir = out_dir / f"{base_name}_images"
        images_saved = save_images_if_present(result, images_dir)

    # If a schema was provided, try to extract a plausible structured payload for convenience
    extraction_keys = ["json", "structured_output", "structured_data", "extractions", "extracted"]
    extraction_obj = None
    if page_schema_json is not None:
        for key in extraction_keys:
            val = result.get(key)
            if isinstance(val, (dict, list)):
                extraction_obj = val
                break
        if extraction_obj is not None:
            extra_json_path = out_dir / f"{base_name}-extractions.json"
            save_json(extraction_obj, extra_json_path)

    # Optional: graphify post-processing
    if (not args.no_save_images) and args.graphify:
        # Verify that images directory exists and has image files
        def _has_local_images(p: Path) -> bool:
            if not p.exists() or not p.is_dir():
                return False
            for child in p.iterdir():
                if child.is_file() and child.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
                    return True
            return False

        if _has_local_images(images_dir):
            # Lazy import to avoid hard dependency when not used
            sys.path.append(str(Path(__file__).parent))
            try:
                import graphify_images  # type: ignore
            except Exception as exc:
                print(f"Graphify unavailable: {exc}", file=sys.stderr)
            else:
                g_api_key = (
                    args.graphify_api_key
                    or os.getenv("GPT_API_KEY")
                    or os.getenv("OPENAI_API_KEY")
                )
                if not g_api_key:
                    print(
                        "Skipping graphify: missing GPT API key (use --graphify-api-key or set GPT_API_KEY/OPENAI_API_KEY)",
                        file=sys.stderr,
                    )
                else:
                    g_api_base = (
                        args.graphify_api_base
                        or os.getenv("GPT_API_BASE")
                        or os.getenv("OPENAI_API_BASE")
                        or "https://api.openai.com/v1"
                    )
                    g_model = args.graphify_model or os.getenv("GPT_MODEL") or "gpt-5-mini"
                    g_out_dir = (
                        Path(args.graphify_out_dir).expanduser().resolve()
                        if args.graphify_out_dir
                        else images_dir.parent / (images_dir.name + "_graphify")
                    )
                    cfg = graphify_images.GptConfig(api_key=g_api_key, api_base=g_api_base, model=g_model)
                    print(
                        f"Graphify: sending images from {images_dir} to model '{g_model}'...",
                        file=sys.stderr,
                    )
                    g_summary = graphify_images.detect_and_reconstruct_graphs(
                        images_dir=images_dir,
                        out_dir=g_out_dir,
                        gpt_cfg=cfg,
                        execute=bool(args.graphify_execute),
                        max_images=args.graphify_max_images,
                        extra_context=args.graphify_context,
                    )
                    print(
                        f"- Graphify summary: {g_summary.get('summary_path')} ({g_summary.get('count')} items)",
                        file=sys.stderr,
                    )
        else:
            print(
                "Skipping graphify: no local images were saved (enable image extraction or check response)",
                file=sys.stderr,
            )

    print("Done.")
    print(f"- JSON response: {response_json_path}")
    if md_path:
        print(f"- Markdown: {md_path}")
    if not args.no_save_images and (images_saved[0] > 0 or images_saved[1] > 0):
        saved_count, url_count = images_saved
        print(
            f"- Images: saved {saved_count} file(s); {url_count} URL(s) (see image_urls.txt if present)"
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())


