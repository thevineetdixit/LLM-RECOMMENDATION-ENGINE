# Model Atlas

A guided LLM model comparison tool. It estimates request cost, filters by hard constraints, and ranks model options using task fit, cost, and speed priorities. Prompt classification, token estimation, cost calculation, and model recommendation are separate modules.

## Start locally

1. Install Node.js 22.9 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and add an OpenRouter API key to enable current model pricing, context windows, and optional JSON classification.
4. Run `npm run dev` and open the Vite URL printed in the terminal.

The app works without a key using local rules and a small clearly labeled example catalog. The key remains on the server. When the optional classifier is enabled, prompt text is sent to OpenRouter for classification; without it, prompt analysis runs locally.

## Recommendation method

See [docs/architecture.md](docs/architecture.md) for the flowchart, data flow, and scoring formula.

- **Input tokens:** estimated with a lightweight character heuristic. Provider-specific tokenizers can be integrated later for better accuracy.
- **Cost:** estimated input and selected output tokens multiplied by the model's input/output price per million tokens.
- **Eligibility:** filters for estimated context fit, vision/tool requirements, and a hard per-request budget.
- **Ranking:** task-weighted quality prior, relative cost score, and speed prior combined using normalized user weights.
- **Catalog:** OpenRouter's authenticated model catalog, which provides model pricing and context metadata. Source and freshness are shown in the UI.
- **Benchmark snapshot:** `server/benchmark-snapshot.json` is explicitly illustrative prototype data. It is not a live benchmark feed. Replace it with dated, sourced results from your own evaluation set before using recommendations for real production decisions.

## Optional classifier configuration

Set `OPENROUTER_API_KEY` in the server `.env` file. This key enables both the live model catalog and the optional structured task classifier. `CLASSIFIER_MODEL` defaults to `openrouter/free`; set it to any model ID available to your account if you prefer a specific JSON-capable model. The server validates the classifier response against an allowlist and clamps the token estimate before use. The recommender remains deterministic and does not ask an LLM to choose a model.

## Project layout

```text
docs/architecture.md             Flowchart and engineering plan
server/index.js                  Catalog proxy, classifier, and benchmark endpoint
server/benchmark-snapshot.json   Versioned illustrative benchmark priors
src/engine.js                    Local analysis, estimates, scoring, and eligibility
src/App.jsx                      Step-by-step product interface
src/styles.css                   Responsive visual design
```
