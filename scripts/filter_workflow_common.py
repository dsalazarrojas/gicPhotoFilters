#!/usr/bin/env python3
from __future__ import annotations

import json
import mimetypes
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = REPO_ROOT / "modelsAI"
REVIEW_DIR = MODELS_DIR / "review"
GENERATED_DIR = REVIEW_DIR / "generated"
STATE_PATH = REVIEW_DIR / "work_items.json"
MANIFEST_PATH = REPO_ROOT / "docs" / "filters-index.json"
DEFAULT_API_URL = "https://photofilters.gic.mx/api/transform"


@dataclass(frozen=True)
class ModelImage:
    image_id: str
    path: Path
    mime_type: str
    extension: str
    tags: list[str]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_review_dirs() -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    temp_path.replace(path)


def sniff_image_extension(path: Path) -> tuple[str, str]:
    with path.open("rb") as handle:
        header = handle.read(16)

    if header.startswith(b"\xff\xd8\xff"):
        return ("image/jpeg", ".jpg")
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return ("image/png", ".png")
    if header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return ("image/webp", ".webp")

    guessed, _ = mimetypes.guess_type(path.name)
    if guessed == "image/png":
        return ("image/png", ".png")
    if guessed == "image/webp":
        return ("image/webp", ".webp")
    return ("image/jpeg", ".jpg")


def image_tags_for_name(name: str) -> list[str]:
    normalized = name.lower()
    tokens = set(re.split(r"[^a-z0-9]+", normalized))
    tags = {"portrait", "person"}

    if "woman" in tokens:
        tags.update({"female", "adult"})
    if "man" in tokens:
        tags.update({"male", "adult"})
    if "boy" in tokens:
        tags.update({"male", "teen"})
    if "girl" in tokens:
        tags.update({"female", "teen"})
    if "child" in tokens:
        tags.update({"child", "young"})
    if "young" in tokens:
        tags.update({"young"})
    if "teen" in tokens or "teenage" in tokens:
        tags.update({"teen", "young"})
    if "middle" in tokens or "aged" in tokens or "40s" in tokens:
        tags.update({"adult", "middle-aged", "professional"})
    if "older" in tokens or "60s" in tokens:
        tags.update({"older", "senior"})
    if "senior" in tokens or "70s" in tokens:
        tags.update({"older", "senior"})

    if "child" not in tags and "teen" not in tags:
        tags.add("adult")

    return sorted(tags)


def discover_model_images() -> list[ModelImage]:
    images: list[ModelImage] = []
    for path in sorted(MODELS_DIR.iterdir()):
        if path.is_dir():
            continue
        if path.name.endswith(".py") or path.name.startswith("."):
            continue
        mime_type, extension = sniff_image_extension(path)
        if not mime_type.startswith("image/"):
            continue
        image_id = re.sub(r"[^a-z0-9]+", "_", path.stem.lower()).strip("_")
        images.append(
            ModelImage(
                image_id=image_id,
                path=path,
                mime_type=mime_type,
                extension=extension,
                tags=image_tags_for_name(path.stem),
            )
        )
    return images


def load_manifest_filters() -> list[dict[str, Any]]:
    payload = read_json(MANIFEST_PATH, default={"filters": []})
    return list(payload.get("filters", []))


def is_supported_human_filter(filter_def: dict[str, Any]) -> bool:
    text = " ".join(
        str(filter_def.get(field, ""))
        for field in ("id", "name", "description", "promptSummary", "prompt", "searchText", "category", "categorySlug")
    ).lower()

    if filter_def.get("clientSideOnly") or filter_def.get("requiresAI") is False:
        return False
    if filter_def.get("categorySlug") == "pets_animals":
        return False
    blocked_terms = (
        "pet ",
        "pets ",
        "animal",
        "2 photos",
        "two uploaded photos",
        "swap faces between two uploaded photos",
        "food face",
        "remove background",
        "object removal",
        "watermark remover",
    )
    if any(term in text for term in blocked_terms):
        return False
    return True


def score_image_for_filter(image: ModelImage, filter_def: dict[str, Any]) -> int:
    text = " ".join(
        str(filter_def.get(field, ""))
        for field in ("id", "name", "description", "promptSummary", "prompt", "searchText", "category", "categorySlug")
    ).lower()

    score = 20

    if "professional" in text or any(word in text for word in ("headshot", "linkedin", "corporate", "author", "teacher", "doctor", "founder", "speaker", "podcast")):
        score += 20 if "professional" in image.tags else 8
        if "adult" in image.tags:
            score += 12
        if "child" in image.tags:
            score -= 30

    if any(word in text for word in ("child", "kid", "toddler", "school", "playful")):
        score += 30 if "child" in image.tags else -20

    if any(word in text for word in ("teen", "teenage", "graduation", "student", "young adult")):
        score += 22 if ("teen" in image.tags or "young" in image.tags) else 0

    if any(word in text for word in ("mother", "mrs.", "woman", "queen", "bride", "female", "girl")):
        score += 16 if "female" in image.tags else -8

    if any(word in text for word in ("father", "mr.", "man", "king", "groom", "male", "boy")):
        score += 16 if "male" in image.tags else -8

    if any(word in text for word in ("senior", "retirement", "grand", "elder", "victorian", "wartime", "vintage")):
        score += 20 if ("older" in image.tags or "senior" in image.tags) else 0

    if any(word in text for word in ("fun", "meme", "anime", "pixar", "action figure", "funko", "lego", "cloud", "underwater")):
        score += 10 if "young" in image.tags else 4

    if any(word in text for word in ("doctor", "teacher", "real estate", "fitness", "coach", "artist", "musician")) and "adult" in image.tags:
        score += 10

    if filter_def.get("estimatedNeurons", 0) <= 100:
        score += 2

    return score


def rank_images_for_filter(images: list[ModelImage], filter_def: dict[str, Any]) -> list[tuple[ModelImage, int]]:
    ranked = [(image, score_image_for_filter(image, filter_def)) for image in images]
    ranked.sort(key=lambda row: (-row[1], row[0].image_id))
    return ranked


def make_item_id(filter_id: str, image_id: str, attempt: int) -> str:
    return f"{filter_id}__{image_id}__v{attempt}"


def relative_to_repo(path: Path) -> str:
    return path.relative_to(REPO_ROOT).as_posix()


def load_state() -> dict[str, Any]:
    ensure_review_dirs()
    state = read_json(STATE_PATH, default=None)
    if state:
        return state
    return {
        "version": 1,
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
        "lastRun": None,
        "items": [],
    }


def save_state(state: dict[str, Any]) -> None:
    state["updatedAt"] = now_iso()
    write_json(STATE_PATH, state)


def find_item(state: dict[str, Any], item_id: str) -> dict[str, Any] | None:
    for item in state.get("items", []):
        if item.get("itemId") == item_id:
            return item
    return None


def generated_pair_dir(item_id: str) -> Path:
    return GENERATED_DIR / item_id
