#!/usr/bin/env python3
from __future__ import annotations

import json
from collections import Counter, OrderedDict
from copy import deepcopy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "docs" / "filters-index.json"
GZIP_PATH = ROOT / "docs" / "filters-index.json.gz"

IMG2IMG_NEGATIVE = "blurry, low quality, deformed hands, extra limbs, warped face, text, watermark, artifacts"
IMG2IMG_SUFFIX = "preserve subject identity, photorealistic, high detail, natural lighting"


def load_json(path: Path) -> OrderedDict:
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=OrderedDict)


def save_json(path: Path, payload: OrderedDict) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def migrate_prompt(prompt: str, source_type: str) -> str:
    text = str(prompt or "").rstrip(". ")
    if source_type == "inpainting":
        text = f"{text}, transform the whole image coherently without requiring a mask"
    elif source_type == "style-transfer":
        text = f"{text}, apply a strong stylistic transformation while keeping the subject recognizable"
    if IMG2IMG_SUFFIX not in text:
        text = f"{text}, {IMG2IMG_SUFFIX}"
    return text


def migrate_manifest() -> None:
    manifest = load_json(MANIFEST_PATH)
    filters = manifest.get("filters", [])

    flux_model = deepcopy(manifest["models"]["flux2-klein-9b"])
    flux_model["name"] = "FLUX.2 Klein 9B"
    flux_model["provider"] = "Cloudflare Workers AI"

    migrated_count = 0

    for item in filters:
        source_model = item.get("model")
        source_type = item.get("type")
        client_side = item.get("clientSideOnly") or item.get("requiresAI") is False or source_model == "client-side"

        if client_side or source_model in {"workers-ai", "workers-ai-or-client-side"}:
            continue

        needs_flux_model = source_model in {"sd15-img2img", "sd15-inpainting"}
        needs_flux_type = source_type in {"style-transfer", "inpainting"}
        if not (needs_flux_model or needs_flux_type):
            continue

        item["sourceModel"] = source_model
        item["sourceType"] = source_type
        item["migrationNote"] = "Migrated to a FLUX img2img-compatible implementation for the website runtime."
        item["model"] = "flux2-klein-9b"
        item["modelName"] = "FLUX.2 Klein 9B"
        item["type"] = "img2img"
        item["strength"] = 0.65
        item["guidance"] = 7.5
        item["outputWidth"] = 768
        item["outputHeight"] = 768
        item["negativePrompt"] = IMG2IMG_NEGATIVE
        item["prompt"] = migrate_prompt(item.get("prompt") or item.get("promptSummary") or item.get("description"), source_type)
        item["estimatedNeurons"] = 150
        item["estimatedRunSeconds"] = 4
        item["costEstimate"] = "≈150 neurons"
        migrated_count += 1

    next_models = OrderedDict()
    next_models["flux2-klein-9b"] = deepcopy(flux_model)
    if "flux2-klein-4b" in manifest["models"]:
      next_models["flux2-klein-4b"] = deepcopy(manifest["models"]["flux2-klein-4b"])
    next_models["client-side"] = deepcopy(manifest["models"]["client-side"])
    next_models["workers-ai"] = deepcopy(manifest["models"]["workers-ai"])
    next_models["workers-ai-or-client-side"] = deepcopy(manifest["models"]["workers-ai-or-client-side"])
    manifest["models"] = next_models

    for category in manifest.get("categories", []):
        category_filters = [item for item in filters if item.get("category") == category.get("slug")]
        category["types"] = OrderedDict(sorted(Counter(item["type"] for item in category_filters).items()))
        category["models"] = OrderedDict(sorted(Counter(item["model"] for item in category_filters).items()))
        category["clientSideCount"] = sum(1 for item in category_filters if item.get("clientSideOnly"))

    type_counts = Counter(item["type"] for item in filters)
    model_counts = Counter(item["model"] for item in filters)
    manifest["facets"]["types"] = [
        OrderedDict([("type", key), ("count", type_counts[key])]) for key in sorted(type_counts)
    ]
    manifest["facets"]["models"] = [
        OrderedDict([("model", key), ("name", manifest["models"][key]["name"]), ("count", model_counts[key])])
        for key in sorted(model_counts)
    ]

    save_json(MANIFEST_PATH, manifest)

    import gzip

    with gzip.open(GZIP_PATH, "wt", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=True, separators=(",", ":"))

    print(f"Migrated {migrated_count} filters to FLUX.")


if __name__ == "__main__":
    migrate_manifest()
