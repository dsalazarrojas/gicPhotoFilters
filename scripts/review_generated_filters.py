#!/usr/bin/env python3
from __future__ import annotations

import argparse
import threading
import webbrowser

from filter_review_app import app
from filter_workflow_common import load_state


def queue_summary() -> str:
    state = load_state()
    counts: dict[str, int] = {}
    for item in state.get("items", []):
        status = str(item.get("status") or "unknown")
        counts[status] = counts.get(status, 0) + 1
    ordered = ", ".join(f"{key}={counts[key]}" for key in sorted(counts))
    return ordered or "empty queue"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Launch the generated filter review UI so accepted pairs can be published to the site and app catalog."
    )
    parser.add_argument("--host", default="127.0.0.1", help="Host interface for the Flask review app.")
    parser.add_argument("--port", type=int, default=5080, help="Port for the Flask review app.")
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Start the review server without opening a browser tab automatically.",
    )
    args = parser.parse_args()

    url = f"http://{args.host}:{args.port}/"
    print(f"Review queue: {queue_summary()}")
    print(f"Review UI: {url}")
    print("Accepted items publish preview images into docs/assets/filter-previews and update the site/app catalogs.")

    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()

    app.run(host=args.host, port=args.port, debug=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
