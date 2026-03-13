#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path
from typing import Any

import requests

from filter_workflow_common import (
    DEFAULT_API_URL,
    find_item,
    generated_pair_dir,
    is_supported_human_filter,
    load_manifest_filters,
    load_state,
    now_iso,
    rank_images_for_filter,
    relative_to_repo,
    save_state,
    discover_model_images,
    ensure_review_dirs,
    make_item_id,
)


STOP_STATUSES = {"accepted", "generated"}
RUNNABLE_STATUSES = {"planned", "queued_retry", "failed"}
PREFERRED_FIRST = [
    "professional-headshot--professional",
    "linkedin-photo--professional",
    "corporate-portrait--professional",
    "author-photo--professional",
    "speaker-keynote--professional",
    "graduation--life_events",
    "anime-portrait--artistic_styles",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build and run filter/image review batches against the transform endpoint."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("init-plan", help="Create or refresh the suggested filter/image work list.")
    init_parser.add_argument("--limit", type=int, default=None, help="Only keep the first N planned items.")

    run_parser = subparsers.add_parser("run-batch", help="Generate a small batch, defaulting to one item.")
    run_parser.add_argument("--count", type=int, default=1, help="Number of runnable items to process in this batch.")
    run_parser.add_argument("--api-url", default=DEFAULT_API_URL, help="Transform endpoint to call.")
    run_parser.add_argument("--item-id", default=None, help="Run exactly one item by id.")
    run_parser.add_argument("--retry-failed", action="store_true", help="Include previously failed items.")
    run_parser.add_argument("--timeout", type=int, default=120, help="HTTP timeout in seconds per call.")

    subparsers.add_parser("report", help="Print queue status.")
    return parser.parse_args()


def build_initial_item(filter_def: dict[str, Any], ranked_images: list[tuple[Any, int]], attempt: int = 1) -> dict[str, Any]:
    selected_image, score = ranked_images[0]
    alternatives = [image.image_id for image, _ in ranked_images[1:]]
    return {
        "itemId": make_item_id(filter_def["id"], selected_image.image_id, attempt),
        "filterId": filter_def["id"],
        "filterSlug": filter_def["slug"],
        "filterName": filter_def["name"],
        "filterCategory": filter_def.get("categorySlug") or filter_def.get("category"),
        "filterType": filter_def.get("type"),
        "filterModel": filter_def.get("model"),
        "estimatedNeurons": filter_def.get("estimatedNeurons"),
        "imageId": selected_image.image_id,
        "imagePath": relative_to_repo(selected_image.path),
        "imageMimeType": selected_image.mime_type,
        "imageExtension": selected_image.extension,
        "imageTags": selected_image.tags,
        "selectionScore": score,
        "alternativeImageIds": alternatives,
        "status": "planned",
        "attempt": attempt,
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
        "generatedAt": None,
        "reviewedAt": None,
        "beforeAsset": None,
        "afterAsset": None,
        "afterMimeType": None,
        "lastError": None,
        "notes": [],
    }


def merge_existing_progress(base_item: dict[str, Any], existing_item: dict[str, Any]) -> dict[str, Any]:
    for key in (
        "status",
        "generatedAt",
        "reviewedAt",
        "beforeAsset",
        "afterAsset",
        "afterMimeType",
        "lastError",
        "notes",
    ):
        if key in existing_item:
            base_item[key] = existing_item[key]
    return base_item


def init_plan(limit: int | None = None) -> int:
    ensure_review_dirs()
    images = discover_model_images()
    if not images:
        raise SystemExit("No source images found in modelsAI.")

    state = load_state()
    existing_by_filter_attempt = {
        (item["filterId"], item.get("attempt", 1)): item for item in state.get("items", [])
    }

    new_items: list[dict[str, Any]] = []
    for filter_def in load_manifest_filters():
        if not is_supported_human_filter(filter_def):
            continue
        ranked = rank_images_for_filter(images, filter_def)
        fresh_item = build_initial_item(filter_def, ranked, attempt=1)
        existing_item = existing_by_filter_attempt.get((filter_def["id"], 1))
        if existing_item:
            fresh_item = merge_existing_progress(fresh_item, existing_item)
        new_items.append(fresh_item)

    priority_index = {filter_id: index for index, filter_id in enumerate(PREFERRED_FIRST)}
    new_items.sort(
        key=lambda item: (
            priority_index.get(item["filterId"], len(PREFERRED_FIRST)),
            item["filterCategory"],
            item["filterSlug"],
        )
    )
    if limit is not None:
        new_items = new_items[:limit]

    retry_items = [
        item for item in state.get("items", [])
        if item.get("attempt", 1) > 1
    ]
    state["items"] = new_items + retry_items
    save_state(state)

    print(f"Plan ready: {len(new_items)} base items, {len(retry_items)} retry items.")
    print("First 10 planned pairs:")
    for item in new_items[:10]:
        print(f"  {item['itemId']} -> {item['filterName']} with {item['imageId']}")
    return 0


def build_headers() -> dict[str, str]:
    import os

    headers: dict[str, str] = {}
    account_id = os.environ.get("CF_ACCOUNT_ID", "").strip()
    api_token = os.environ.get("CF_API_TOKEN", "").strip()
    if account_id:
        headers["X-CF-Account-ID"] = account_id
    if api_token:
        headers["X-CF-API-Token"] = api_token
    return headers


def looks_like_quota_error(response: requests.Response, message: str) -> bool:
    text = f"{response.status_code} {message}".lower()
    quota_terms = (
        "429",
        "rate limit",
        "quota",
        "exhaust",
        "neurons",
        "credits",
        "points",
        "too many requests",
    )
    if response.status_code == 429:
        return True
    if response.status_code in (402, 403) and any(term in text for term in quota_terms):
        return True
    return any(term in text for term in quota_terms if term != "429")


def parse_error_message(response: requests.Response) -> str:
    content_type = response.headers.get("content-type", "").lower()
    try:
        payload = response.json()
    except ValueError:
        body = response.text.strip()
        if "text/html" in content_type:
            title_match = re.search(r"<title>(.*?)</title>", body, re.IGNORECASE | re.DOTALL)
            if title_match:
                title = re.sub(r"\s+", " ", title_match.group(1)).strip()
                if title:
                    return title
        return body or response.reason or f"HTTP {response.status_code}"

    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            return str(error.get("message") or error.get("code") or payload)
        return str(error or payload.get("message") or payload)
    return str(payload)


def pick_items_for_run(state: dict[str, Any], count: int, item_id: str | None, retry_failed: bool) -> list[dict[str, Any]]:
    if item_id:
        item = find_item(state, item_id)
        if not item:
            raise SystemExit(f"Item not found: {item_id}")
        return [item]

    allowed_statuses = {"planned", "queued_retry"}
    if retry_failed:
        allowed_statuses.add("failed")

    selected: list[dict[str, Any]] = []
    for item in state.get("items", []):
        if item.get("status") not in allowed_statuses:
            continue
        selected.append(item)
        if len(selected) >= count:
            break
    return selected


def generate_item(item: dict[str, Any], api_url: str, timeout_seconds: int) -> tuple[str, str | None]:
    repo_root = Path(__file__).resolve().parents[1]
    source_path = repo_root / item["imagePath"]
    output_dir = generated_pair_dir(item["itemId"])
    output_dir.mkdir(parents=True, exist_ok=True)

    before_path = output_dir / f"before{source_path.suffix or item.get('imageExtension') or '.jpg'}"
    shutil.copy2(source_path, before_path)

    files = {
        "image": (before_path.name, before_path.read_bytes(), item.get("imageMimeType") or "image/jpeg"),
    }
    data = {
        "filterId": item["filterId"],
    }

    try:
        response = requests.post(
            api_url,
            headers=build_headers(),
            data=data,
            files=files,
            timeout=timeout_seconds,
        )
    except requests.RequestException as error:
        return ("failed", str(error))

    if not response.ok:
        message = parse_error_message(response)
        if looks_like_quota_error(response, message):
            return ("quota_exhausted", message)
        return ("failed", message)

    content_type = response.headers.get("content-type", "image/png").split(";")[0].strip().lower()
    extension = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }.get(content_type, ".img")
    after_path = output_dir / f"after{extension}"
    after_path.write_bytes(response.content)

    item["beforeAsset"] = relative_to_repo(before_path)
    item["afterAsset"] = relative_to_repo(after_path)
    item["afterMimeType"] = content_type
    item["generatedAt"] = now_iso()
    item["updatedAt"] = now_iso()
    item["lastError"] = None
    item["status"] = "generated"
    return ("generated", None)


def run_batch(count: int, api_url: str, item_id: str | None, retry_failed: bool, timeout_seconds: int) -> int:
    state = load_state()
    items = pick_items_for_run(state, count=count, item_id=item_id, retry_failed=retry_failed)
    if not items:
        print("No runnable items found.")
        return 0

    state["lastRun"] = {
        "startedAt": now_iso(),
        "apiUrl": api_url,
        "requestedCount": count,
        "selectedItemIds": [item["itemId"] for item in items],
        "stoppedReason": "completed",
        "completedAt": None,
    }
    save_state(state)

    for index, item in enumerate(items, start=1):
        print(f"[{index}/{len(items)}] {item['itemId']}")
        status, message = generate_item(item, api_url=api_url, timeout_seconds=timeout_seconds)
        if status == "generated":
            print(f"  generated -> {item['afterAsset']}")
            save_state(state)
            continue

        item["status"] = status
        item["lastError"] = {
            "message": message,
            "at": now_iso(),
        }
        item["updatedAt"] = now_iso()
        save_state(state)

        if status == "quota_exhausted":
            state["lastRun"]["stoppedReason"] = "quota_exhausted"
            save_state(state)
            print(f"  stopping: {message}")
            break

        print(f"  failed: {message}")

    state["lastRun"]["completedAt"] = now_iso()
    save_state(state)
    return 0


def report() -> int:
    state = load_state()
    counts: dict[str, int] = {}
    for item in state.get("items", []):
        status = item.get("status", "unknown")
        counts[status] = counts.get(status, 0) + 1

    print("Queue status:")
    for status in sorted(counts):
        print(f"  {status}: {counts[status]}")

    last_run = state.get("lastRun")
    if last_run:
        print("Last run:")
        print(f"  startedAt: {last_run.get('startedAt')}")
        print(f"  completedAt: {last_run.get('completedAt')}")
        print(f"  stoppedReason: {last_run.get('stoppedReason')}")
    return 0


def main() -> int:
    args = parse_args()
    if args.command == "init-plan":
        return init_plan(limit=args.limit)
    if args.command == "run-batch":
        return run_batch(
            count=max(1, args.count),
            api_url=args.api_url,
            item_id=args.item_id,
            retry_failed=args.retry_failed,
            timeout_seconds=max(1, args.timeout),
        )
    if args.command == "report":
        return report()
    raise SystemExit(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    sys.exit(main())
