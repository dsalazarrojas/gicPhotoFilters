#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from flask import Flask, abort, redirect, render_template_string, request, send_file, url_for

from filter_workflow_common import (
    REPO_ROOT,
    discover_model_images,
    find_item,
    is_supported_human_filter,
    publish_item_to_site,
    load_manifest_filters,
    load_state,
    make_item_id,
    now_iso,
    rank_images_for_filter,
    relative_to_repo,
    save_state,
)


app = Flask(__name__)


PAGE_TEMPLATE = """
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Filter Review</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6efe8;
      --panel: #fffaf7;
      --text: #2b1a12;
      --muted: #785b4a;
      --accent: #db5c22;
      --accent-dark: #b94716;
      --border: #efcdbd;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: linear-gradient(180deg, #fff7f2 0%, var(--bg) 100%);
      color: var(--text);
    }
    a { color: inherit; }
    .page {
      max-width: 1180px;
      margin: 0 auto;
      padding: 24px;
    }
    .toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .stats, .list, .viewer {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 18px;
      box-shadow: 0 10px 30px rgba(102, 52, 25, 0.08);
    }
    .stats {
      padding: 16px 18px;
      margin-bottom: 20px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
    }
    .stat strong { display: block; font-size: 28px; }
    .content {
      display: grid;
      grid-template-columns: 320px minmax(0, 1fr);
      gap: 20px;
    }
    .list {
      padding: 16px;
      max-height: calc(100vh - 180px);
      overflow: auto;
    }
    .list-item {
      display: block;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 14px;
      text-decoration: none;
      margin-bottom: 10px;
      background: #fff;
    }
    .list-item.active {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(219, 92, 34, 0.12);
    }
    .list-item small {
      display: block;
      color: var(--muted);
      margin-top: 4px;
    }
    .viewer {
      padding: 20px;
    }
    .compare {
      position: relative;
      overflow: hidden;
      border-radius: 20px;
      aspect-ratio: 1 / 1;
      background: #ead8ca;
      margin-bottom: 16px;
    }
    .compare img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      background: #ead8ca;
    }
    .compare .after {
      position: absolute;
      inset: 0;
      clip-path: inset(0 calc(100% - var(--pos, 50%)) 0 0);
    }
    .divider {
      position: absolute;
      top: 0;
      bottom: 0;
      left: var(--pos, 50%);
      width: 2px;
      background: #fff;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.14);
      transform: translateX(-1px);
    }
    .divider::after {
      content: "< >";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--accent);
      color: #fff;
      padding: 8px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: bold;
      letter-spacing: 1px;
    }
    .range {
      width: 100%;
      accent-color: var(--accent);
      margin-bottom: 18px;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .badge {
      padding: 6px 10px;
      border-radius: 999px;
      background: #fff;
      border: 1px solid var(--border);
      color: var(--muted);
      font-size: 13px;
    }
    .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin: 18px 0;
    }
    button {
      border: 0;
      border-radius: 999px;
      padding: 12px 18px;
      cursor: pointer;
      color: #fff;
      background: var(--accent);
      font-weight: bold;
    }
    button.secondary { background: #8c6a59; }
    button.ghost {
      background: #fff;
      color: var(--accent-dark);
      border: 1px solid var(--border);
    }
    .meta {
      color: var(--muted);
      line-height: 1.5;
      font-size: 14px;
    }
    @media (max-width: 900px) {
      .content { grid-template-columns: 1fr; }
      .list { max-height: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="toolbar">
      <div>
        <h1 style="margin:0;">Filter Review Queue</h1>
        <p style="margin:6px 0 0; color: var(--muted);">Review generated before/after pairs and keep the queue moving.</p>
      </div>
      <div><a href="{{ url_for('index') }}">Refresh</a></div>
    </div>

    <div class="stats">
      {% for key, value in stats.items() %}
      <div class="stat"><strong>{{ value }}</strong><span>{{ key }}</span></div>
      {% endfor %}
    </div>

    <div class="content">
      <aside class="list">
        {% for row in review_items %}
        <a class="list-item {% if current and row.itemId == current.itemId %}active{% endif %}" href="{{ url_for('index', item=row.itemId) }}">
          <strong>{{ row.filterName }}</strong>
          <small>{{ row.imageId }} · {{ row.status }} · attempt {{ row.attempt }}</small>
        </a>
        {% endfor %}
      </aside>

      <section class="viewer">
        {% if current %}
          <h2 style="margin-top:0;">{{ current.filterName }}</h2>
          <div class="badges">
            <span class="badge">{{ current.filterId }}</span>
            <span class="badge">{{ current.imageId }}</span>
            <span class="badge">{{ current.filterModel }}</span>
            <span class="badge">{{ current.estimatedNeurons }} neurons</span>
          </div>

          <div class="compare" id="compare" style="--pos: 52%;">
            <img src="{{ url_for('asset', rel_path=current.beforeAsset) }}" alt="Before" />
            <div class="after">
              <img src="{{ url_for('asset', rel_path=current.afterAsset) }}" alt="After" />
            </div>
            <div class="divider"></div>
          </div>
          <input id="range" class="range" type="range" min="0" max="100" value="52" />

          <form class="actions" method="post" action="{{ url_for('decision', item_id=current.itemId) }}">
            <button name="action" value="accept" type="submit">Accept</button>
            <button class="secondary" name="action" value="reject_retry" type="submit">Reject + Queue Another Image</button>
            <button class="ghost" name="action" value="reject" type="submit">Reject Only</button>
          </form>

          <div class="meta">
            <p><strong>Source:</strong> {{ current.imagePath }}</p>
            <p><strong>Before:</strong> {{ current.beforeAsset }}<br /><strong>After:</strong> {{ current.afterAsset }}</p>
            <p><strong>Alternatives:</strong> {{ ", ".join(current.alternativeImageIds[:5]) if current.alternativeImageIds else "None left" }}</p>
            <p><strong>Last error:</strong> {{ current.lastError.message if current.lastError else "None" }}</p>
          </div>
        {% else %}
          <p>No generated items are waiting for review yet.</p>
        {% endif %}
      </section>
    </div>
  </div>
  <script>
    const range = document.getElementById('range');
    const compare = document.getElementById('compare');
    if (range && compare) {
      const sync = () => compare.style.setProperty('--pos', range.value + '%');
      range.addEventListener('input', sync);
      sync();
    }
  </script>
</body>
</html>
"""


def queue_stats(state: dict) -> dict[str, int]:
    stats = {
        "pending review": 0,
        "planned": 0,
        "accepted": 0,
        "rejected": 0,
        "failed": 0,
    }
    for item in state.get("items", []):
        status = item.get("status")
        if status == "generated":
            stats["pending review"] += 1
        elif status in stats:
            stats[status] += 1
    return stats


def review_candidates(state: dict) -> list[dict]:
    items = [item for item in state.get("items", []) if item.get("status") == "generated" and item.get("beforeAsset") and item.get("afterAsset")]
    items.sort(key=lambda item: item.get("generatedAt") or "", reverse=True)
    return items


def create_retry_item(state: dict, item: dict) -> dict | None:
    manifest = {filter_def["id"]: filter_def for filter_def in load_manifest_filters() if is_supported_human_filter(filter_def)}
    filter_def = manifest.get(item["filterId"])
    if not filter_def:
      return None

    images = discover_model_images()
    ranked = rank_images_for_filter(images, filter_def)

    used_image_ids = {
        row["imageId"]
        for row in state.get("items", [])
        if row.get("filterId") == item["filterId"]
    }

    for image, score in ranked:
        if image.image_id in used_image_ids:
            continue
        next_attempt = 1 + max(
            (row.get("attempt", 1) for row in state.get("items", []) if row.get("filterId") == item["filterId"]),
            default=1,
        )
        retry_item = {
            "itemId": make_item_id(item["filterId"], image.image_id, next_attempt),
            "filterId": item["filterId"],
            "filterSlug": item["filterSlug"],
            "filterName": item["filterName"],
            "filterCategory": item.get("filterCategory"),
            "filterType": item.get("filterType"),
            "filterModel": item.get("filterModel"),
            "estimatedNeurons": item.get("estimatedNeurons"),
            "imageId": image.image_id,
            "imagePath": relative_to_repo(image.path),
            "imageMimeType": image.mime_type,
            "imageExtension": image.extension,
            "imageTags": image.tags,
            "selectionScore": score,
            "alternativeImageIds": [row.image_id for row, _ in ranked if row.image_id not in used_image_ids and row.image_id != image.image_id],
            "status": "queued_retry",
            "attempt": next_attempt,
            "createdAt": now_iso(),
            "updatedAt": now_iso(),
            "generatedAt": None,
            "reviewedAt": None,
            "beforeAsset": None,
            "afterAsset": None,
            "afterMimeType": None,
            "lastError": None,
            "notes": [f"Queued from rejected item {item['itemId']}"],
        }
        state["items"].append(retry_item)
        return retry_item
    return None


@app.get("/")
def index():
    state = load_state()
    candidates = review_candidates(state)
    current = None
    requested_item_id = request.args.get("item", "").strip()
    if requested_item_id:
        current = find_item(state, requested_item_id)
        if current and current.get("status") != "generated":
            current = None
    if current is None and candidates:
        current = candidates[0]

    return render_template_string(
        PAGE_TEMPLATE,
        stats=queue_stats(state),
        review_items=candidates,
        current=current,
    )


@app.post("/decision/<item_id>")
def decision(item_id: str):
    state = load_state()
    item = find_item(state, item_id)
    if not item:
        abort(404)

    action = request.form.get("action", "").strip()
    if action == "accept":
        item["status"] = "accepted"
        item["reviewedAt"] = now_iso()
        item["updatedAt"] = now_iso()
        published = publish_item_to_site(item)
        item["publishedPreview"] = published
        item["publishedAt"] = now_iso()
    elif action == "reject":
        item["status"] = "rejected"
        item["reviewedAt"] = now_iso()
        item["updatedAt"] = now_iso()
    elif action == "reject_retry":
        item["status"] = "rejected"
        item["reviewedAt"] = now_iso()
        item["updatedAt"] = now_iso()
        create_retry_item(state, item)
    else:
        abort(400)

    save_state(state)
    return redirect(url_for("index"))


@app.get("/asset/<path:rel_path>")
def asset(rel_path: str):
    path = (REPO_ROOT / rel_path).resolve()
    try:
        path.relative_to(REPO_ROOT)
    except ValueError:
        abort(404)
    if not path.exists():
        abort(404)
    return send_file(path)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5040, debug=True)
