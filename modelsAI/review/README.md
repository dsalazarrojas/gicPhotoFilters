# Filter Review Workflow

Queue file:

- `modelsAI/review/work_items.json`

Create or refresh the suggested filter/image list:

```bash
python3 scripts/filter_batch_workflow.py init-plan
```

Run a one-item test batch first:

```bash
CF_ACCOUNT_ID=... CF_API_TOKEN=... \
python3 scripts/filter_batch_workflow.py run-batch --count 1
```

Run a larger batch later:

```bash
CF_ACCOUNT_ID=... CF_API_TOKEN=... \
python3 scripts/filter_batch_workflow.py run-batch --count 5
```

Show queue status:

```bash
python3 scripts/filter_batch_workflow.py report
```

Open the review UI:

```bash
python3 scripts/filter_review_app.py
```

Then visit:

- `http://127.0.0.1:5040`

Review actions:

- `Accept`: keep this pair as the chosen example.
- `Reject Only`: mark it rejected and stop there.
- `Reject + Queue Another Image`: reject the current pair and automatically schedule the same filter with another source image.

Batch stop behavior:

- The batch runner stops as soon as Cloudflare returns a quota/rate-limit style error such as neurons/quota exhausted.
