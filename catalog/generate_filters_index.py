#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter, OrderedDict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
PRD_PATH = ROOT / 'PRD.md'
PRD_FALLBACK_PATHS = [
    ROOT / 'PRD202603121254.md',
]
CONFIG_PATH = Path(__file__).resolve().with_name('catalog-config.json')
OUTPUT_PATH = ROOT / 'docs' / 'filters-index.json'
GZIP_OUTPUT_PATH = ROOT / 'docs' / 'filters-index.json.gz'

MODEL_NORMALIZATION = {
    'FLUX.2 klein': 'flux2-klein-9b',
    'SD v1.5 img2img': 'flux2-klein-9b',
    'SD v1.5 Inpainting': 'flux2-klein-9b',
    'client-side': 'client-side',
    'Workers AI': 'workers-ai',
    'Workers AI / client-side': 'workers-ai-or-client-side',
}

STOPWORDS = {
    'a', 'an', 'and', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or',
    'photo', 'portrait', 'style', 'this', 'the', 'to', 'transform', 'transformation', 'turn',
    'up', 'with', 'your', 'person', 'persona', 'persons', 'make', 'look', 'show', 'through',
    'standing', 'walking', 'place', 'add', 'apply', 'output', 'remove', 'change', 'classic',
    'transforming', 'made', 'entirely', 'persons', 'using', 'while', 'preserve', 'preserving'
}

NEGATIVE_PROMPTS = {
    'img2img': 'blurry, low quality, deformed hands, extra limbs, warped face, text, watermark, artifacts',
    'inpainting': 'obvious seams, blurry edit, low quality, distorted anatomy, text, watermark, artifacts',
    'style-transfer': 'muddy colors, low quality, distorted face, extra limbs, text, watermark, artifacts',
    'utility': '',
    'overlay': '',
}

PROMPT_SUFFIXES = {
    'img2img': 'preserve subject identity, photorealistic, high detail, natural lighting',
    'inpainting': 'seamless targeted edit, preserve subject identity, photorealistic, natural lighting',
    'style-transfer': 'preserve composition and recognizable features, high detail',
    'utility': '',
    'overlay': '',
}


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding='utf-8'))


def slugify(text: str) -> str:
    replacements = {
        'B&W': 'Black White',
        '&': ' and ',
        '/': ' ',
        '+': ' plus ',
        '@': ' at ',
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    text = re.sub(r"['’`\"]", '', text)
    text = re.sub(r'[^a-zA-Z0-9]+', '-', text).strip('-').lower()
    text = re.sub(r'-{2,}', '-', text)
    return text


def clean_text(value: str) -> str:
    return value.strip().strip('"').strip()


def parse_prd_date(text: str, fallback_date: str) -> str:
    match = re.search(r'^\*\*Date:\*\*\s+(.+)$', text, re.MULTILINE)
    if not match:
        return fallback_date
    return match.group(1).strip()


def table_cells(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip('|').split('|')]


def parse_category_summary(prd_text: str) -> dict[str, dict[str, Any]]:
    summary: dict[str, dict[str, Any]] = {}
    in_section = False
    for line in prd_text.splitlines():
        if line.startswith('## 5. Category Summary'):
            in_section = True
            continue
        if in_section and line.startswith('## 6.'):
            break
        if not in_section or not line.startswith('| '):
            continue
        if line.startswith('| #') or line.startswith('|---'):
            continue
        cells = table_cells(line)
        if not cells or len(cells) < 6 or cells[1] == '**Total**':
            continue
        order = int(cells[0])
        name = clean_text(cells[1])
        slug = clean_text(cells[2]).strip('`')
        count = int(clean_text(cells[3]))
        icon_cell = clean_text(cells[4])
        icon_match = re.match(r'(.+?)\s*`([^`]+)`$', icon_cell)
        emoji = icon_match.group(1).strip() if icon_match else icon_cell
        system_image = icon_match.group(2).strip() if icon_match else ''
        summary[name] = {
            'order': order,
            'name': name,
            'slug': slug,
            'count': count,
            'emoji': emoji,
            'systemImage': system_image,
            'aiRequirement': clean_text(cells[5]),
            'pageSlug': slug.replace('_', '-'),
        }
    return summary


def normalize_type(raw_type: str) -> str:
    raw_type = clean_text(raw_type)
    if raw_type.startswith('overlay'):
        return 'overlay'
    return raw_type


def effective_type(filter_type: str, model_key: str) -> str:
    if model_key == 'client-side':
        return filter_type
    if filter_type in {'style-transfer', 'inpainting'}:
        return 'img2img'
    return filter_type


def build_prompt(summary: str, filter_type: str, original_type: str | None = None) -> str:
    suffix = PROMPT_SUFFIXES[filter_type]
    summary = summary.rstrip('.')
    if original_type == 'inpainting':
        summary = f'{summary}, transform the whole image coherently without requiring a mask'
    elif original_type == 'style-transfer':
        summary = f'{summary}, apply a strong stylistic transformation while keeping the subject recognizable'
    return summary if not suffix else f'{summary}, {suffix}'


def normalize_model(raw_model: str, filter_type: str) -> str:
    if filter_type == 'overlay':
        return 'client-side'
    raw_model = clean_text(raw_model)
    return MODEL_NORMALIZATION.get(raw_model, slugify(raw_model))


def parse_filter_sections(prd_text: str, category_summary: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    filters: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for line in prd_text.splitlines():
        heading = re.match(r'^### 4\.(\d+)\s+(?:[^\s]+\s+)?(.+?)\s+\((\d+) filters.*\)$', line)
        if heading:
            category_name = heading.group(2).strip()
            current = {
                'order': int(heading.group(1)),
                'name': category_name,
                'expectedCount': int(heading.group(3)),
                'rows': [],
            }
            continue
        if line.startswith('## 5. Category Summary'):
            break
        if current is None:
            continue
        if line.startswith('| #') or line.startswith('|---') or not line.startswith('| '):
            continue
        cells = table_cells(line)
        if current['name'] == 'Effects & Filters':
            number, name, summary_text, raw_type = cells
            raw_model = 'client-side'
        else:
            number, name, summary_text, raw_type, raw_model = cells
        info = category_summary[current['name']]
        filter_type = normalize_type(raw_type)
        slug = slugify(name)
        filters.append({
            'number': int(number),
            'name': clean_text(name),
            'slug': slug,
            'summary': clean_text(summary_text),
            'type': filter_type,
            'rawModel': clean_text(raw_model),
            'model': normalize_model(raw_model, filter_type),
            'category': info['slug'],
            'categoryDisplay': info['name'],
            'categoryPageSlug': info['pageSlug'],
            'categoryOrder': info['order'],
            'emoji': info['emoji'],
            'systemImage': info['systemImage'],
            'aiRequirement': info['aiRequirement'],
        })
        current['rows'].append(name)
    counts = Counter(item['category'] for item in filters)
    for category in category_summary.values():
        if category['slug'] in counts and counts[category['slug']] != category['count']:
            raise ValueError(
                f"Category count mismatch for {category['slug']}: parsed {counts[category['slug']]} vs summary {category['count']}"
            )
    return filters


def load_prd_source() -> tuple[Path, str, dict[str, dict[str, Any]], list[dict[str, Any]]]:
    candidate_paths = [PRD_PATH, *PRD_FALLBACK_PATHS]
    for path in candidate_paths:
        if not path.exists():
            continue
        prd_text = path.read_text(encoding='utf-8')
        category_summary = parse_category_summary(prd_text)
        parsed_filters = parse_filter_sections(prd_text, category_summary)
        if category_summary and parsed_filters:
            return path, prd_text, category_summary, parsed_filters
    searched = ', '.join(str(path.relative_to(ROOT)) for path in candidate_paths if path.exists())
    raise ValueError(f'Unable to find PRD filter tables in any known source file: {searched}')


def month_order(months: list[int]) -> list[int]:
    return sorted(dict.fromkeys(months))


def extract_tokens(text: str) -> list[str]:
    ascii_text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii').lower()
    tokens = re.findall(r'[a-z0-9]+', ascii_text)
    return [token for token in tokens if len(token) > 1 and token not in STOPWORDS]


def build_tags(filter_row: dict[str, Any], config: dict[str, Any], is_demo: bool, is_seasonal: bool, client_side_only: bool) -> list[str]:
    tags: list[str] = []
    tags.extend(config['categoryKeywords'].get(filter_row['category'], []))
    tags.extend(extract_tokens(filter_row['name']))
    tags.extend(extract_tokens(filter_row['summary']))
    if filter_row['type'] == 'overlay':
        tags.append('overlay')
    if client_side_only:
        tags.extend(['instant', 'browser'])
    if is_demo:
        tags.append('demo')
    if is_seasonal:
        tags.append('seasonal')
    if filter_row['category'] == 'utility_tools':
        tags.append('practical')
    deduped: list[str] = []
    for tag in tags:
        normalized = slugify(tag).replace('-', ' ')
        if normalized and normalized not in deduped:
            deduped.append(normalized)
    return deduped[:12]


def default_cost_estimate(estimated_neurons: int, requires_ai: bool, client_side_only: bool) -> str:
    if client_side_only or not requires_ai and estimated_neurons == 0:
        return 'Free (client-side)'
    if estimated_neurons == 0:
        return 'Free'
    return f'≈{estimated_neurons} neurons'


def resolve_active_month(config: dict[str, Any]) -> int:
    for key in ('generatedAt', 'sourceDate'):
        raw_value = str(config.get(key, '')).strip()
        if not raw_value:
            continue
        try:
            return datetime.fromisoformat(raw_value.replace('Z', '+00:00')).month
        except ValueError:
            continue
    return datetime.now(timezone.utc).month


def validate_viral_tags(config: dict[str, Any], known_slugs: set[str]) -> None:
    invalid: list[str] = []
    for trend_id, trend in config.get('viralTags', {}).items():
        if not isinstance(trend, dict):
            invalid.append(f'{trend_id}:<invalid-trend>')
            continue
        for slug in trend.get('filters', []):
            if slug not in known_slugs:
                invalid.append(f'{trend_id}:{slug}')
    if invalid:
        joined = ', '.join(invalid)
        raise ValueError(f'viralTags references unknown filter slugs: {joined}')


def build_viral_score_map(config: dict[str, Any]) -> dict[str, int]:
    scores: dict[str, int] = {}
    for trend in config.get('viralTags', {}).values():
        if not isinstance(trend, dict) or not trend.get('active'):
            continue
        priority = max(0, int(trend.get('priority', 0)))
        score = max(95, min(100, 95 + round(priority / 20)))
        for slug in trend.get('filters', []):
            scores[slug] = max(scores.get(slug, 0), score)
    return scores


def calculate_viral_score(
    slug: str,
    seasonal_months: list[int],
    is_demo: bool,
    active_month: int,
    viral_score_map: dict[str, int],
) -> int:
    if slug in viral_score_map:
        return viral_score_map[slug]
    if active_month in seasonal_months:
        return 70
    if is_demo:
        return 50
    return 0


def build_share_text(name: str, emoji: str, is_demo: bool, client_side_only: bool) -> str:
    if client_side_only:
        return f'I just tried the {name} effect on GIC Photo Filters {emoji}'
    if is_demo:
        return f'I just tried the {name} filter free on GIC Photo Filters {emoji}'
    return f'I just tried the {name} filter on GIC Photo Filters {emoji}'


def build_filter_record(
    filter_row: dict[str, Any],
    config: dict[str, Any],
    active_month: int,
    viral_score_map: dict[str, int],
) -> OrderedDict[str, Any]:
    slug = filter_row['slug']
    utility_override = config['utilityOverrides'].get(slug, {})
    original_type = filter_row['type']
    original_model_key = utility_override.get('model', filter_row['model'])
    model_key = original_model_key
    if original_model_key in {'sd15-img2img', 'sd15-inpainting'}:
        model_key = 'flux2-klein-9b'
    filter_type = effective_type(original_type, model_key)
    type_defaults = config['typeDefaults'][filter_type]
    model_meta = config['models'][model_key]
    seasonal_months = month_order(config['seasonalMonthsBySlug'].get(slug, []))
    is_seasonal = bool(seasonal_months)
    is_demo = slug in set(config['demoFilterSlugs'])
    client_side_only = utility_override.get('clientSideOnly', model_key == 'client-side')
    requires_ai = utility_override.get('requiresAI', not client_side_only and model_key != 'workers-ai-or-client-side')
    estimated_neurons = utility_override.get('estimatedNeurons', model_meta['neuronsPerRun'])
    estimated_seconds = utility_override.get('estimatedSeconds', model_meta['estimatedSeconds'])
    cost_estimate = utility_override.get(
        'costEstimate',
        default_cost_estimate(estimated_neurons, requires_ai, client_side_only),
    )
    viral_score = calculate_viral_score(slug, seasonal_months, is_demo, active_month, viral_score_map)
    tags = build_tags(filter_row, config, is_demo=is_demo, is_seasonal=is_seasonal, client_side_only=client_side_only)
    description = filter_row['summary'].rstrip('.') + '.'
    search_text = ' '.join(
        [
            filter_row['name'],
            filter_row['categoryDisplay'],
            description,
            ' '.join(tags),
        ]
    ).lower()
    prompt = build_prompt(filter_row['summary'], filter_type, original_type=original_type)
    record: OrderedDict[str, Any] = OrderedDict()
    record['number'] = filter_row['number']
    record['id'] = f"{slug}--{filter_row['category']}"
    record['name'] = filter_row['name']
    record['slug'] = slug
    record['category'] = filter_row['category']
    record['categorySlug'] = filter_row['category']
    record['categoryDisplay'] = filter_row['categoryDisplay']
    record['categoryPageSlug'] = filter_row['categoryPageSlug']
    record['description'] = description
    record['promptSummary'] = filter_row['summary']
    record['prompt'] = prompt
    record['negativePrompt'] = NEGATIVE_PROMPTS[filter_type]
    record['type'] = filter_type
    record['model'] = model_key
    record['modelName'] = model_meta['name']
    if original_type != filter_type:
        record['sourceType'] = original_type
    if original_model_key != model_key:
        record['sourceModel'] = original_model_key
    if original_type != filter_type or original_model_key != model_key:
        record['migrationNote'] = 'Migrated to a FLUX img2img-compatible implementation for the website runtime.'
    record['systemImage'] = filter_row['systemImage']
    record['strength'] = type_defaults['strength']
    record['guidance'] = type_defaults['guidance']
    record['outputWidth'] = type_defaults['outputWidth']
    record['outputHeight'] = type_defaults['outputHeight']
    record['variantCount'] = type_defaults['variantCount']
    record['isDemoFilter'] = is_demo
    record['viralScore'] = viral_score
    record['isSeasonalHighlight'] = is_seasonal
    record['seasonalMonths'] = seasonal_months
    record['requiresAI'] = requires_ai
    record['clientSideOnly'] = client_side_only
    record['estimatedNeurons'] = estimated_neurons
    record['estimatedRunSeconds'] = estimated_seconds
    record['costEstimate'] = cost_estimate
    record['tags'] = tags
    record['shareText'] = build_share_text(filter_row['name'], filter_row['emoji'], is_demo, client_side_only)
    record['searchText'] = search_text
    record['tryPath'] = f"try.html?id={record['id']}"
    record['categoryPath'] = f"categories/{filter_row['categoryPageSlug']}.html"
    return record


def preserve_existing_previews(filters: list[OrderedDict[str, Any]]) -> None:
    if not OUTPUT_PATH.exists():
        return
    existing = load_json(OUTPUT_PATH)
    preview_map = {
        item['id']: item for item in existing.get('filters', [])
        if item.get('previewImages') or item.get('previewBefore') or item.get('previewAfter')
    }
    for item in filters:
        existing_item = preview_map.get(item['id'])
        if not existing_item:
            continue
        if existing_item.get('previewImages'):
            item['previewImages'] = existing_item['previewImages']
        if existing_item.get('previewBefore'):
            item['previewBefore'] = existing_item['previewBefore']
        if existing_item.get('previewAfter'):
            item['previewAfter'] = existing_item['previewAfter']


def build_categories(filters: list[OrderedDict[str, Any]], category_summary: dict[str, dict[str, Any]], config: dict[str, Any]) -> list[OrderedDict[str, Any]]:
    by_category: dict[str, list[OrderedDict[str, Any]]] = {}
    for item in filters:
        by_category.setdefault(item['category'], []).append(item)
    category_index = {info['slug']: info for info in category_summary.values()}
    categories: list[OrderedDict[str, Any]] = []
    for slug, items in sorted(by_category.items(), key=lambda pair: category_index[pair[0]]['order']):
        info = category_index[slug]
        type_counts = Counter(item['type'] for item in items)
        model_counts = Counter(item['model'] for item in items)
        category: OrderedDict[str, Any] = OrderedDict()
        category['id'] = slug
        category['slug'] = slug
        category['pageSlug'] = info['pageSlug']
        category['name'] = info['name']
        category['emoji'] = info['emoji']
        category['systemImage'] = info['systemImage']
        category['description'] = config['categoryDescriptions'][slug]
        category['aiRequirement'] = info['aiRequirement']
        category['filterCount'] = len(items)
        category['demoCount'] = sum(1 for item in items if item['isDemoFilter'])
        category['seasonalCount'] = sum(1 for item in items if item['isSeasonalHighlight'])
        category['clientSideCount'] = sum(1 for item in items if item['clientSideOnly'])
        category['types'] = OrderedDict(sorted(type_counts.items()))
        category['models'] = OrderedDict(sorted(model_counts.items()))
        category['keywords'] = config['categoryKeywords'][slug]
        category['sampleFilterIds'] = [item['id'] for item in items[:4]]
        category['categoryPath'] = f"categories/{info['pageSlug']}.html"
        categories.append(category)
    return categories


def build_planned_categories(category_summary: dict[str, dict[str, Any]], actual_categories: set[str], config: dict[str, Any]) -> list[OrderedDict[str, Any]]:
    planned: list[OrderedDict[str, Any]] = []
    for info in sorted(category_summary.values(), key=lambda item: item['order']):
        if info['slug'] in actual_categories:
            continue
        category: OrderedDict[str, Any] = OrderedDict()
        category['id'] = info['slug']
        category['slug'] = info['slug']
        category['pageSlug'] = info['pageSlug']
        category['name'] = info['name']
        category['emoji'] = info['emoji']
        category['systemImage'] = info['systemImage']
        category['description'] = config['categoryDescriptions'][info['slug']]
        category['aiRequirement'] = info['aiRequirement']
        category['plannedFilterCount'] = info['count']
        category['status'] = 'planned'
        category['keywords'] = config['categoryKeywords'][info['slug']]
        planned.append(category)
    return planned


def build_facets(filters: list[OrderedDict[str, Any]], categories: list[OrderedDict[str, Any]], config: dict[str, Any]) -> OrderedDict[str, Any]:
    type_counts = Counter(item['type'] for item in filters)
    model_counts = Counter(item['model'] for item in filters)
    month_map: OrderedDict[int, list[str]] = OrderedDict((month, []) for month in range(1, 13))
    for item in filters:
        for month in item['seasonalMonths']:
            month_map[month].append(item['id'])
    facets: OrderedDict[str, Any] = OrderedDict()
    facets['categories'] = [
        OrderedDict([('slug', category['slug']), ('name', category['name']), ('count', category['filterCount'])])
        for category in categories
    ]
    facets['types'] = [OrderedDict([('type', key), ('count', type_counts[key])]) for key in sorted(type_counts)]
    facets['models'] = [
        OrderedDict([
            ('model', key),
            ('name', config['models'][key]['name']),
            ('count', model_counts[key]),
        ])
        for key in sorted(model_counts)
    ]
    facets['months'] = [
        OrderedDict([
            ('month', month),
            ('count', len(ids)),
            ('filterIds', ids),
        ])
        for month, ids in month_map.items()
    ]
    return facets


def build_catalog() -> OrderedDict[str, Any]:
    config = load_json(CONFIG_PATH)
    prd_path, prd_text, category_summary, parsed_filters = load_prd_source()
    known_slugs = {item['slug'] for item in parsed_filters}
    validate_viral_tags(config, known_slugs)
    active_month = resolve_active_month(config)
    viral_score_map = build_viral_score_map(config)
    filters = [build_filter_record(item, config, active_month, viral_score_map) for item in parsed_filters]
    preserve_existing_previews(filters)
    categories = build_categories(filters, category_summary, config)
    actual_categories = {category['slug'] for category in categories}
    planned_categories = build_planned_categories(category_summary, actual_categories, config)
    facets = build_facets(filters, categories, config)
    catalog_hash = hashlib.sha256(
        (prd_text + json.dumps(config, sort_keys=True, ensure_ascii=False)).encode('utf-8')
    ).hexdigest()[:16]
    catalog: OrderedDict[str, Any] = OrderedDict()
    catalog['schemaVersion'] = config['schemaVersion']
    catalog['generatedAt'] = config['generatedAt']
    catalog['catalogHash'] = catalog_hash
    catalog['source'] = OrderedDict([
        ('repository', 'gicPhotoFilters'),
        ('prdPath', str(prd_path.relative_to(ROOT))),
        ('prdDate', parse_prd_date(prd_text, config['sourceDate'])),
        ('generator', 'catalog/generate_filters_index.py'),
        ('config', 'catalog/catalog-config.json'),
        (
            'notes',
            [
                'Generated from the PRD section 4 filter tables and section 5 category summary.',
                'PRD section 5 lists 4 extra planned categories without filter rows; they are preserved under plannedCategories.',
            ],
        ),
    ])
    catalog['totalFilters'] = len(filters)
    catalog['totalCategories'] = len(categories)
    catalog['plannedCategoryCount'] = len(planned_categories)
    catalog['dailyFreeNeurons'] = config['dailyFreeNeurons']
    catalog['freeTransformsPerIp'] = config['freeTransformsPerIp']
    catalog['starterTransforms'] = config['starterTransforms']
    catalog['referralBonusTransforms'] = config['referralBonusTransforms']
    catalog['referralThreshold'] = config['referralThreshold']
    catalog['starterBonusCapPerDay'] = config['starterBonusCapPerDay']
    catalog['cloudflareFreeDailyEstimate'] = config['cloudflareFreeDailyEstimate']
    catalog['byokPromptAfterSuccess'] = config['byokPromptAfterSuccess']
    catalog['embedAllowed'] = config['embedAllowed']
    catalog['challengeMode'] = config['challengeMode']
    catalog['viralTags'] = config['viralTags']
    catalog['models'] = config['models']
    catalog['categories'] = categories
    catalog['plannedCategories'] = planned_categories
    catalog['demoFilterIds'] = [item['id'] for item in filters if item['isDemoFilter']]
    catalog['seasonalCalendar'] = facets['months']
    catalog['facets'] = facets
    catalog['stats'] = OrderedDict([
        ('demoFilters', len(catalog['demoFilterIds'])),
        ('seasonalFilters', sum(1 for item in filters if item['isSeasonalHighlight'])),
        ('clientSideFilters', sum(1 for item in filters if item['clientSideOnly'])),
        ('activeViralTrends', sum(1 for item in config['viralTags'].values() if item.get('active'))),
    ])
    catalog['filters'] = filters
    if catalog['totalFilters'] != 205:
        raise ValueError(f"Expected 205 filters, found {catalog['totalFilters']}")
    return catalog


def render_catalog(catalog: OrderedDict[str, Any]) -> str:
    return json.dumps(catalog, indent=2, ensure_ascii=False) + '\n'


def main() -> int:
    parser = argparse.ArgumentParser(description='Generate docs/filters-index.json from PRD.md')
    parser.add_argument('--check', action='store_true', help='Fail if docs/filters-index.json is not up to date')
    args = parser.parse_args()

    catalog = build_catalog()
    rendered = render_catalog(catalog)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    if args.check:
        existing = OUTPUT_PATH.read_text(encoding='utf-8') if OUTPUT_PATH.exists() else None
        existing_gzip = gzip.decompress(GZIP_OUTPUT_PATH.read_bytes()).decode('utf-8') if GZIP_OUTPUT_PATH.exists() else None
        if existing != rendered or existing_gzip != rendered:
            print('filters-index.json is out of date', file=sys.stderr)
            return 1
        print(f'filters-index.json is up to date ({catalog["totalFilters"]} filters)')
        return 0

    OUTPUT_PATH.write_text(rendered, encoding='utf-8')
    GZIP_OUTPUT_PATH.write_bytes(gzip.compress(rendered.encode('utf-8'), compresslevel=9, mtime=0))
    print(f'Wrote {OUTPUT_PATH.relative_to(ROOT)} with {catalog["totalFilters"]} filters across {catalog["totalCategories"]} categories')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
