export const fallbackModels = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini (example)', provider: 'openai', contextWindow: 128000, inputPerMillion: 0.15, outputPerMillion: 0.6, modalities: ['text'], supportsTools: true },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude Haiku (example)', provider: 'anthropic', contextWindow: 200000, inputPerMillion: 0.8, outputPerMillion: 4, modalities: ['text'], supportsTools: true },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini Flash (example)', provider: 'google', contextWindow: 1000000, inputPerMillion: 0.1, outputPerMillion: 0.4, modalities: ['text', 'image'], supportsTools: true },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat (example)', provider: 'deepseek', contextWindow: 64000, inputPerMillion: 0.27, outputPerMillion: 1.1, modalities: ['text'], supportsTools: true },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (example)', provider: 'meta-llama', contextWindow: 128000, inputPerMillion: 0.4, outputPerMillion: 0.4, modalities: ['text'], supportsTools: true },
  { id: 'mistralai/mistral-small-3.1-24b-instruct', name: 'Mistral Small (example)', provider: 'mistralai', contextWindow: 128000, inputPerMillion: 0.1, outputPerMillion: 0.3, modalities: ['text', 'image'], supportsTools: true },
  { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B (example)', provider: 'qwen', contextWindow: 32000, inputPerMillion: 0.1, outputPerMillion: 0.3, modalities: ['text'], supportsTools: true },
];

export const taskLabels = { coding: 'Code & build', reasoning: 'Reasoning', math: 'Math', writing: 'Writing', translation: 'Translation', general: 'General' };

export function analyzeLocally(prompt) {
  const p = prompt.toLowerCase();
  let taskType = 'general';
  if (/\b(code|coding|program|bug|javascript|python|sql|algorithm|compile|function|api)\b/.test(p)) taskType = 'coding';
  else if (/\b(math|calculate|equation|integral|prove|probability|algebra)\b/.test(p)) taskType = 'math';
  else if (/\b(translate|translation| in french| in spanish| in hindi)\b/.test(p)) taskType = 'translation';
  else if (/\b(write|rewrite|email|story|blog|copy|tone|essay)\b/.test(p)) taskType = 'writing';
  else if (/\b(analy[sz]e|reason|compare|evaluate|trade.?off|explain why|step.?by.?step)\b/.test(p)) taskType = 'reasoning';
  const complexity = p.length > 600 || /\b(complex|difficult|advanced|comprehensive|detailed|multiple|step by step)\b/.test(p) ? 'high' : p.length < 100 ? 'low' : 'medium';
  return { taskType, complexity, expectedOutputTokens: Math.min(2200, Math.max(120, Math.round(prompt.trim().split(/\s+/).length * (complexity === 'high' ? 5 : complexity === 'medium' ? 3 : 1.5)))), needsVision: /\b(image|picture|photo|screenshot|diagram)\b/.test(p), needsTools: /\b(search|browse|current|latest|calculate exactly)\b/.test(p), source: 'Local rules' };
}

export function estimateInputTokens(prompt) { return prompt.trim() ? Math.ceil(prompt.trim().length / 3.7) : 0; }
export function estimateCost(model, inputTokens, outputTokens) { return inputTokens / 1e6 * model.inputPerMillion + outputTokens / 1e6 * model.outputPerMillion; }
const taskDimensions = { coding: [['coding', .65], ['reasoning', .25], ['instruction', .10]], reasoning: [['reasoning', .55], ['instruction', .25], ['math', .20]], math: [['math', .65], ['reasoning', .25], ['instruction', .10]], writing: [['writing', .65], ['instruction', .25], ['reasoning', .10]], translation: [['translation', .65], ['instruction', .25], ['writing', .10]], general: [['instruction', .50], ['reasoning', .25], ['writing', .25]] };
const familyFor = (provider, families) => families?.[provider] || null;

export function recommend({ models, snapshot, profile, inputTokens, outputTokens, weights, budget, requiredContext = 0 }) {
  const priced = models.map((model) => {
    const stats = familyFor(model.provider, snapshot?.families) || snapshot?.defaults || {};
    const dimensions = taskDimensions[profile.taskType] || taskDimensions.general;
    const quality = dimensions.reduce((sum, [key, weight]) => sum + (Number(stats[key] ?? 60) * weight), 0);
    return { ...model, stats, quality, speed: Number(stats.speed ?? 60), cost: estimateCost(model, inputTokens, outputTokens) };
  });
  const eligible = priced.filter((m) => m.contextWindow >= Math.max(requiredContext, inputTokens + outputTokens) && (!profile.needsVision || m.modalities?.includes('image')) && (!profile.needsTools || m.supportsTools) && (!Number.isFinite(budget) || m.cost <= budget));
  const costs = eligible.map((m) => m.cost), lo = Math.min(...costs), hi = Math.max(...costs);
  const ranked = eligible.map((m) => {
    const costScore = hi === lo ? 100 : 100 * (hi - m.cost) / (hi - lo);
    const q = Number(weights.quality), c = Number(weights.cost), s = Number(weights.speed), total = q + c + s || 1;
    const score = m.quality * q / total + costScore * c / total + m.speed * s / total;
    return { ...m, costScore, score };
  }).sort((a, b) => b.score - a.score);
  return { ranked, best: ranked[0], cheapest: [...ranked].sort((a, b) => a.cost - b.cost)[0], fastest: [...ranked].sort((a, b) => b.speed - a.speed)[0], eligibleCount: eligible.length, totalCount: models.length };
}

export function money(value, currency = 'USD') {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '$0.00';
  if (value < .0001) return `$${value.toFixed(7)}`;
  if (value < .01) return `$${value.toFixed(5)}`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 4 }).format(value);
}
