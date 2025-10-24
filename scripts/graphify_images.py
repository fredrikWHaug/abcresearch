#!/usr/bin/env python3
"""
Graphify: Send images to a GPT vision model to detect graphs, extract editable data,
and generate Python code that can reconstruct the plot. Optionally execute that code
to regenerate an image.

Default model: gpt-5-mini (configurable). API is OpenAI-compatible via HTTP.

Environment variables (overridden by function args):
- GPT_API_KEY or OPENAI_API_KEY
- GPT_API_BASE or OPENAI_API_BASE (default: https://api.openai.com/v1)
- GPT_MODEL (default: gpt-5-mini)

Dependencies: requests, matplotlib (only if executing generated code)
"""

from __future__ import annotations

import base64
import json
import os
import re
import sys
import traceback
import time
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed
from multiprocessing import Process, Queue
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests


SUPPORTED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


@dataclass
class GptConfig:
    api_key: str
    api_base: str = "https://api.openai.com/v1"
    model: str = "gpt-5-mini"
    timeout_s: int = 120
    temperature: float = 1


def infer_mime_type(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if ext == ".png":
        return "image/png"
    if ext == ".webp":
        return "image/webp"
    return "application/octet-stream"


def to_data_url(mime: str, b64: str) -> str:
    return f"data:{mime};base64,{b64}"


def load_image_b64(path: Path) -> Tuple[str, str]:
    mime = infer_mime_type(path)
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return mime, b64


def call_gpt_vision_json(
    cfg: GptConfig,
    image_path: Path,
    extra_context: Optional[str] = None,
) -> Dict[str, Any]:
    mime, b64 = load_image_b64(image_path)
    data_url = to_data_url(mime, b64)
    url = cfg.api_base.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    schema_desc = (
        "Return a JSON object with keys: is_graph (bool), graph_type (string), reason (string), "
        "data (object with arrays/series suitable for plotting), python_code (string), assumptions (string). "
        "In python_code, define a function recreate_plot(output_path: str) that recreates the plot using matplotlib "
        "(Agg backend) and saves to output_path without showing UI."
    )

    user_text = (
        "You are a scientific figure analyzer. Determine if the image is a data visualization (graph/chart/plot). "
        "If yes, extract approximate numeric data and produce Python code to reconstruct it. "
        "Prefer simple lists of numbers over dataframes. Include title/axes/legend when inferable. "
        "Do not use external files or network. Do not embed the image itself in output. "
        f"Schema: {schema_desc} "
    )
    if extra_context:
        user_text += f"\nContext: {extra_context}"

    base_body = {
        "model": cfg.model,
        "temperature": cfg.temperature,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": (
                    "You convert static images of figures into approximate datasets and minimal plotting code. "
                    "When data is ambiguous, make reasonable numeric approximations and note them in assumptions."
                ),
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_text},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
    }

    body = dict(base_body)
    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            resp = requests.post(url, headers=headers, json=body, timeout=cfg.timeout_s)
            data = resp.json()
        except requests.exceptions.Timeout as exc:
            if attempt == max_attempts:
                raise SystemExit(f"GPT API timeout on {image_path.name}: {exc}")
            time.sleep(min(2 ** (attempt - 1), 8))
            continue
        except Exception:
            resp.raise_for_status()
            raise SystemExit(
                f"Non-JSON response from GPT API (HTTP {resp.status_code}): {resp.text[:500]}"
            )

        if resp.status_code >= 400:
            err = data.get("error", {}) if isinstance(data, dict) else {}
            param = err.get("param")
            message = err.get("message", "")

            if param == "temperature" or ("temperature" in message.lower() and "unsupported" in message.lower()):
                if "temperature" in body:
                    body = dict(body)
                    body.pop("temperature", None)
                if attempt == max_attempts:
                    raise SystemExit(f"GPT API error: {data}")
                time.sleep(min(2 ** (attempt - 1), 8))
                continue

            if param == "response_format" or ("response_format" in message.lower() and "unsupported" in message.lower()):
                if "response_format" in body:
                    body = dict(body)
                    body.pop("response_format", None)
                    body_messages = list(body.get("messages", []))
                    body_messages.insert(0, {"role": "system", "content": "Respond with strict JSON only."})
                    body["messages"] = body_messages
                if attempt == max_attempts:
                    raise SystemExit(f"GPT API error: {data}")
                time.sleep(min(2 ** (attempt - 1), 8))
                continue

            status = resp.status_code
            if status == 429 or 500 <= status < 600:
                if attempt == max_attempts:
                    raise SystemExit(f"GPT API error after retries: {data}")
                time.sleep(min(2 ** (attempt - 1), 8))
                continue

            raise SystemExit(f"GPT API error: {data}")

        content = data.get("choices", [{}])[0].get("message", {}).get("content")
        if not content:
            raise SystemExit(f"GPT API returned empty content: {data}")
        try:
            parsed = json.loads(content)
        except Exception as exc:
            raise SystemExit(f"Failed to parse GPT JSON content: {exc}. Raw: {content[:500]}")
        return parsed

    raise SystemExit("GPT API call failed after retries")


def sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "-", name).strip("-")
    return cleaned or "untitled"


def _exec_child(code: str, output_path: str, result_queue: Queue) -> None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        plt.show = lambda *a, **k: None  # no-op to avoid blocking
        global_ns: Dict[str, Any] = {}
        local_ns: Dict[str, Any] = {}
        compiled = compile(code, filename="<gpt_code>", mode="exec")
        exec(compiled, global_ns, local_ns)
        recreate = local_ns.get("recreate_plot") or global_ns.get("recreate_plot")
        if not callable(recreate):
            result_queue.put({"ok": False, "error": "No recreate_plot(output_path: str) found"})
            return
        recreate(output_path)
        try:
            plt.close("all")
        except Exception:
            pass
        result_queue.put({"ok": True})
    except Exception as exc:
        result_queue.put({"ok": False, "error": f"Execution error: {exc}\n{traceback.format_exc()}"})


def execute_generated_code(python_code: str, output_path: Path, exec_timeout_s: int = 30) -> Tuple[bool, Optional[str]]:
    q: Queue = Queue()
    p = Process(target=_exec_child, args=(python_code, str(output_path), q))
    p.start()
    p.join(exec_timeout_s)
    if p.is_alive():
        try:
            p.kill()
        except Exception:
            pass
        p.join(1)
        return False, f"Execution timed out after {exec_timeout_s}s"
    try:
        res = q.get_nowait()
    except Exception:
        return False, "No result returned from execution"
    if res.get("ok"):
        return True, None
    return False, res.get("error") or "Unknown execution error"


def iter_images(images_dir: Path) -> Iterable[Path]:
    for path in sorted(images_dir.iterdir()):
        if path.is_file() and path.suffix.lower() in SUPPORTED_IMAGE_EXTS:
            yield path


def detect_and_reconstruct_graphs(
    images_dir: Path,
    out_dir: Path,
    gpt_cfg: GptConfig,
    execute: bool = False,
    max_images: Optional[int] = None,
    extra_context: Optional[str] = None,
    concurrency: int = 3,
    exec_timeout_s: int = 30,
) -> Dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    summary: List[Dict[str, Any]] = []

    images: List[Path] = []
    for img_path in iter_images(images_dir):
        images.append(img_path)
    if max_images is not None:
        images = images[: max_images]

    def _process(img_path: Path) -> Dict[str, Any]:
        print(f"[graphify] processing {img_path.name}", file=sys.stderr)
        base = sanitize_filename(img_path.stem)
        json_path = out_dir / f"{base}.graph.json"
        recon_path = out_dir / f"{base}.reconstructed.png"

        try:
            result = call_gpt_vision_json(gpt_cfg, img_path, extra_context=extra_context)
        except Exception as exc:
            result = {
                "is_graph": False,
                "error": f"GPT call failed: {exc}",
            }
        else:
            result.setdefault("is_graph", False)

        # Save raw JSON result
        try:
            json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as exc:
            result = dict(result)
            result["error"] = (result.get("error") or "") + f" | save-json-error: {exc}"

        reconstructed_ok = False
        exec_error: Optional[str] = None
        if execute and result.get("is_graph") and isinstance(result.get("python_code"), str):
            reconstructed_ok, exec_error = execute_generated_code(result["python_code"], recon_path, exec_timeout_s=exec_timeout_s)

        entry = {
            "image": str(img_path),
            "json": str(json_path),
            "reconstructed": str(recon_path) if reconstructed_ok else None,
            "is_graph": bool(result.get("is_graph")),
            "graph_type": result.get("graph_type"),
            "error": result.get("error") or exec_error,
        }
        print(f"[graphify] done {img_path.name} (is_graph={entry['is_graph']})", file=sys.stderr)
        return entry

    if concurrency and concurrency > 1:
        with ThreadPoolExecutor(max_workers=concurrency) as pool:
            futures = {pool.submit(_process, p): p for p in images}
            for fut in as_completed(futures):
                try:
                    entry = fut.result()
                except Exception as exc:
                    entry = {
                        "image": str(futures[fut]),
                        "json": None,
                        "reconstructed": None,
                        "is_graph": False,
                        "graph_type": None,
                        "error": f"worker-error: {exc}",
                    }
                summary.append(entry)
    else:
        for p in images:
            summary.append(_process(p))

    summary_path = out_dir / "summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"summary_path": str(summary_path), "count": len(summary)}


def main(argv: Optional[List[str]] = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Classify images as graphs and reconstruct plots via GPT")
    parser.add_argument("images_dir", type=str, help="Directory containing extracted images")
    parser.add_argument("--out-dir", type=str, default=None, help="Output directory for graphify results")
    parser.add_argument("--api-key", type=str, default=None, help="GPT API key (or GPT_API_KEY/OPENAI_API_KEY)")
    parser.add_argument("--api-base", type=str, default=None, help="GPT API base (or GPT_API_BASE/OPENAI_API_BASE)")
    parser.add_argument("--model", type=str, default=None, help="Model name (or GPT_MODEL; default gpt-5-mini)")
    parser.add_argument("--max-images", type=int, default=None, help="Limit number of images to process")
    parser.add_argument("--execute", action="store_true", help="Execute generated code to reconstruct plots")
    parser.add_argument("--context", type=str, default=None, help="Extra textual context for the model")
    parser.add_argument("--timeout-s", type=int, default=None, help="Per-request timeout seconds (default 120)")
    parser.add_argument("--concurrency", type=int, default=3, help="Parallel workers for images (default 3)")
    parser.add_argument("--exec-timeout-s", type=int, default=30, help="Seconds to allow plot code execution (default 30)")

    args = parser.parse_args(argv)

    images_dir = Path(args.images_dir).expanduser().resolve()
    if not images_dir.exists() or not images_dir.is_dir():
        print(f"Images directory not found: {images_dir}", file=sys.stderr)
        return 2

    out_dir = (
        Path(args.out_dir).expanduser().resolve() if args.out_dir else images_dir.parent / (images_dir.name + "_graphify")
    )

    api_key = args.api_key or os.getenv("GPT_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Missing GPT API key. Provide --api-key or set GPT_API_KEY/OPENAI_API_KEY.", file=sys.stderr)
        return 2
    api_base = args.api_base or os.getenv("GPT_API_BASE") or os.getenv("OPENAI_API_BASE") or "https://api.openai.com/v1"
    model = args.model or os.getenv("GPT_MODEL") or "gpt-5-mini"

    timeout_s = args.timeout_s if args.timeout_s is not None else 120
    cfg = GptConfig(api_key=api_key, api_base=api_base, model=model, timeout_s=timeout_s)
    result = detect_and_reconstruct_graphs(
        images_dir=images_dir,
        out_dir=out_dir,
        gpt_cfg=cfg,
        execute=bool(args.execute),
        max_images=args.max_images,
        extra_context=args.context,
        concurrency=max(1, int(args.concurrency)),
        exec_timeout_s=max(1, int(args.exec_timeout_s)),
    )

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


