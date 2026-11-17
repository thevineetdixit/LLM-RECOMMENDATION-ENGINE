import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Check, ChevronDown, CircleHelp, Clock3, Compass, Cpu, FileText, Info, RefreshCw, ShieldCheck, Sparkles, Wallet, Zap } from 'lucide-react';
import { analyzeLocally, estimateInputTokens, fallbackModels, money, recommend, taskLabels } from './engine.js';

const samples = [
  { label: 'Solve a coding problem', task: 'coding', text: 'Design an efficient solution to this graph problem. Explain the approach, prove its correctness, and provide clean Python code with time and space complexity.' },
  { label: 'Explain a concept', task: 'reasoning', text: 'Explain how binary search works to someone new to programming. Use a small example and describe when it is useful.' },
  { label: 'Write something', task: 'writing', text: 'Write a concise, friendly product launch email for a new budgeting app. Include a clear call to action.' },
];
const priorities = [
  { id: 'quality', title: 'Best answer', note: 'Prioritize task capability', weights: { quality: 80, cost: 15, speed: 5 }, icon: BadgeCheck },
  { id: 'balanced', title: 'Balanced', note: 'A practical mix of quality and cost', weights: { quality: 55, cost: 30, speed: 15 }, icon: Compass },
  { id: 'cost', title: 'Lowest cost', note: 'Favor lower estimated spend', weights: { quality: 25, cost: 65, speed: 10 }, icon: Wallet },
  { id: 'speed', title: 'Fast response', note: 'Favor the speed estimate', weights: { quality: 35, cost: 15, speed: 50 }, icon: Zap },
];
const stepPath = ['/', '/preferences', '/results'];
const stepName = ['Prompt', 'Preferences', 'Results'];
function pathStep() { const index = stepPath.indexOf(window.location.pathname); return index < 0 ? 0 : index; }
function OptionCard({ selected, onClick, icon: Icon, title, note, badge }) {
  return <button type="button" className={`option-card ${selected ? 'selected' : ''}`} onClick={onClick} aria-pressed={selected}>
    {Icon && <span className="option-icon"><Icon size={18} /></span>}<span className="option-copy"><b>{title}</b><small>{note}</small></span>{badge && <span className="option-badge">{badge}</span>}{selected && <span className="selected-check"><Check size={14} /></span>}
  </button>;
}
function Stepper({ step, maxStep, go }) {
  return <nav className="stepper" aria-label="Recommendation steps">{stepName.map((name, i) => <button key={name} className={`step-tab ${i === step ? 'current' : ''} ${i < step ? 'done' : ''}`} onClick={() => i <= maxStep && go(i)} disabled={i > maxStep} aria-current={i === step ? 'step' : undefined}><span className="step-num">{i < step ? <Check size={13} /> : `0${i + 1}`}</span><span>{name}</span></button>)}</nav>;
}
function ModelRow({ model, index, selected, inputTokens, outputTokens }) {
  return <div className={`compare-row ${selected ? 'chosen' : ''}`}>
    <span className="compare-rank">{String(index + 1).padStart(2, '0')}</span>
    <span className="compare-model"><i className={`provider-dot p-${model.provider}`} /> <span><b>{model.name}</b><small>{model.provider.replaceAll('-', ' ')} · {(model.contextWindow / 1000).toFixed(0)}k context</small></span></span>
    <span className="compare-fit"><i><b style={{ width: `${model.quality}%` }} /></i><b>{Math.round(model.quality)}</b></span>
    <span className="compare-cost">{money(model.cost)}<small>per request</small></span>
    <span className="compare-score">{Math.round(model.score)}<small>score</small></span>
  </div>;
}

export default function App() {
  const [step, setStep] = useState(pathStep);
  const [furthest, setFurthest] = useState(pathStep);
  const [prompt, setPrompt] = useState('');
  const [profile, setProfile] = useState({ ...analyzeLocally(''), taskType: 'general' });
  const [models, setModels] = useState(fallbackModels);
  const [snapshot, setSnapshot] = useState(null);
  const [catalogStatus, setCatalogStatus] = useState('loading');
  const [apiEnabled, setApiEnabled] = useState(false);
  const [priority, setPriority] = useState('balanced');
  const [budgetChoice, setBudgetChoice] = useState('none');
  const [customBudget, setCustomBudget] = useState('');
  const [outputTokens, setOutputTokens] = useState(500);
  const [requestsPerDay, setRequestsPerDay] = useState(1000);
  const [volumeChoice, setVolumeChoice] = useState('1000');
  const [classified, setClassified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [allModels, setAllModels] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const onPop = () => setStep(pathStep());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    Promise.all([
      fetch('/api/models').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/benchmarks').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/health').then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([catalog, data, health]) => {
      if (catalog?.models?.length) { setModels(catalog.models); setCatalogStatus('live'); }
      else setCatalogStatus('sample');
      setSnapshot(data); setApiEnabled(Boolean(health?.classifierEnabled));
    });
  }, []);

  const inputTokens = estimateInputTokens(prompt);
  const selectedPriority = priorities.find((p) => p.id === priority) || priorities[1];
  const budget = budgetChoice === 'none' ? Infinity : budgetChoice === 'custom' ? (customBudget ? Number(customBudget) : Infinity) : Number(budgetChoice);
  const results = useMemo(() => recommend({ models, snapshot, profile, inputTokens, outputTokens, weights: selectedPriority.weights, budget }), [models, snapshot, profile, inputTokens, outputTokens, selectedPriority, budget]);

  function goTo(next) {
    const clamped = Math.max(0, Math.min(2, next));
    setStep(clamped); setFurthest((old) => Math.max(old, clamped));
    if (window.location.pathname !== stepPath[clamped]) window.history.pushState({ step: clamped }, '', stepPath[clamped]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function chooseSample(sample) { setPrompt(sample.text); setProfile({ ...analyzeLocally(sample.text), taskType: sample.task }); setClassified(false); setNotice(''); }
  function chooseTask(taskType) { setProfile((old) => ({ ...old, taskType })); setClassified(false); }
  async function analyze() {
    if (!prompt.trim()) { setNotice('Add a prompt or pick a starter example first.'); return; }
    setBusy(true); setNotice('');
    if (!apiEnabled) { setProfile(analyzeLocally(prompt)); setClassified(false); setBusy(false); return; }
    try {
      const response = await fetch('/api/classify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      if (!response.ok) throw new Error('Classification unavailable');
      const data = await response.json(); setProfile(data); setOutputTokens(data.expectedOutputTokens); setClassified(true);
    } catch { setProfile(analyzeLocally(prompt)); setClassified(false); setNotice('Using local task analysis. The optional classifier could not be reached.'); }
    finally { setBusy(false); }
  }
  function onPrompt(value) { setPrompt(value); setProfile({ ...analyzeLocally(value), taskType: profile.taskType }); setClassified(false); }

  return <div className="product">
    <header className="topbar"><a className="brand" href="/" onClick={(e) => { e.preventDefault(); goTo(0); }}><span className="brand-mark"><Compass size={19} /></span><span>MODEL<span className="brand-accent">ATLAS</span></span></a><div className="topbar-right"><span className={`catalog-status ${catalogStatus === 'live' ? 'is-live' : ''}`}><i />{catalogStatus === 'live' ? 'Live model data' : catalogStatus === 'loading' ? 'Loading models' : 'Sample data'}<b>{models.length}</b></span><span className="topbar-divider" /> <a className="help-link" href="#method" onClick={(e) => { if (step !== 2) return; e.preventDefault(); document.getElementById('method')?.scrollIntoView({ behavior: 'smooth' }); }}>How scoring works <CircleHelp size={15} /></a></div></header>
    <Stepper step={step} maxStep={furthest} go={goTo} />

    {step === 0 && <main className="wizard-page prompt-page">
      <div className="page-intro"><span className="eyebrow">STEP 1 OF 3 <i /></span><h1>What do you need<br />the model to <em>do?</em></h1><p>Start with a representative prompt. We’ll estimate the request and compare suitable models.</p></div>
      <div className="wizard-panel"><label className="field-label" htmlFor="prompt-input">Your prompt <small>Up to 12,000 characters</small></label><textarea id="prompt-input" value={prompt} onChange={(e) => onPrompt(e.target.value)} maxLength={12000} placeholder="Paste or write a prompt you want to compare…" /><div className="prompt-meta"><span><FileText size={14} /> {inputTokens.toLocaleString()} estimated input tokens</span><span>{prompt.length.toLocaleString()} / 12,000</span></div>
        <div className="starter-area"><div className="subhead"><b>Need a starting point?</b><small>Choose an example to try</small></div><div className="starter-buttons">{samples.map((sample) => <button key={sample.label} className="starter-button" onClick={() => chooseSample(sample)}>{sample.label}<ArrowUpRight size={14} /></button>)}</div></div>
        <div className="task-area"><div className="subhead"><b>What kind of task is it?</b><small>Choose one; this guides the capability match</small></div><div className="task-buttons">{Object.entries(taskLabels).map(([id, label]) => <button key={id} className={`task-button ${profile.taskType === id ? 'selected' : ''}`} onClick={() => chooseTask(id)} aria-pressed={profile.taskType === id}>{label}</button>)}</div></div>
        {notice && <p className="notice">{notice}</p>}
        <div className="panel-footer"><span className="privacy-hint"><ShieldCheck size={14} /> Prompt classification runs locally by default.</span><button className="btn btn-dark" onClick={() => { analyze(); }} disabled={busy}>{busy ? 'Analyzing…' : classified ? 'Profile ready' : 'Analyze prompt'}<Sparkles size={15} /></button><button className="btn btn-primary" onClick={() => { if (!prompt.trim()) { setNotice('Add a prompt or pick a starter example first.'); return; } goTo(1); }}>Choose priorities <ArrowRight size={16} /></button></div>
        {apiEnabled && <p className="privacy-footnote">Optional JSON classification sends this prompt to OpenRouter using the server key.</p>}
      </div>
    </main>}

    {step === 1 && <main className="wizard-page preferences-page">
      <button className="back-link" onClick={() => goTo(0)}><ArrowLeft size={15} /> Back to prompt</button><div className="page-intro compact"><span className="eyebrow">STEP 2 OF 3 <i /></span><h1>Set your <em>priorities.</em></h1><p>Pick what matters and set a spending limit. You can change these anytime.</p></div>
      <div className="wizard-panel preferences-panel">
        <section className="choice-section"><div className="section-heading"><span className="section-number">01</span><div><h2>Optimize for</h2><p>Choose how the recommender should balance the trade-offs.</p></div></div><div className="option-grid four">{priorities.map((p) => <OptionCard key={p.id} selected={priority === p.id} onClick={() => setPriority(p.id)} icon={p.icon} title={p.title} note={p.note} />)}</div></section>
        <section className="choice-section"><div className="section-heading"><span className="section-number">02</span><div><h2>Maximum cost per request</h2><p>This is a hard limit. Models above it won’t be recommended.</p></div></div><div className="option-grid budget-options">{[{id:'none',title:'No limit',note:'Compare all models'},{id:'0.001',title:'$0.001',note:'One tenth of a cent'},{id:'0.005',title:'$0.005',note:'Half a cent'},{id:'0.01',title:'$0.01',note:'One cent'},{id:'custom',title:'Custom',note:'Set your own'}].map((o) => <OptionCard key={o.id} selected={budgetChoice === o.id} onClick={() => setBudgetChoice(o.id)} title={o.title} note={o.note} />)}</div>{budgetChoice === 'custom' && <label className="custom-budget">Your limit (USD)<span><i>$</i><input type="number" min="0" step="0.001" value={customBudget} onChange={(e) => setCustomBudget(e.target.value)} placeholder="0.005" /></span></label>}</section>
        <section className="choice-section last-choice"><div className="section-heading"><span className="section-number">03</span><div><h2>Expected answer length</h2><p>Output length is an estimate, not a known value.</p></div></div><div className="option-grid three">{[{v:150,t:'Short',n:'~150 tokens'},{v:500,t:'Medium',n:'~500 tokens'},{v:1200,t:'Long',n:'~1,200 tokens'},{v:2200,t:'Extended',n:'~2,200 tokens'}].map((o) => <OptionCard key={o.v} selected={outputTokens === o.v} onClick={() => setOutputTokens(o.v)} title={o.t} note={o.n} />)}</div></section>
        <div className="panel-footer preferences-footer"><button className="btn btn-light" onClick={() => goTo(0)}><ArrowLeft size={15} /> Back</button><span className="quiet-summary">{taskLabels[profile.taskType]} · {inputTokens.toLocaleString()} input tokens</span><button className="btn btn-primary" onClick={() => goTo(2)}>See recommendations <ArrowRight size={16} /></button></div>
      </div>
    </main>}

    {step === 2 && <main className="wizard-page results-page">
      <button className="back-link" onClick={() => goTo(1)}><ArrowLeft size={15} /> Edit preferences</button><div className="page-intro results-intro"><span className="eyebrow">STEP 3 OF 3 <i /></span><h1>Your best-fit <em>models.</em></h1><p>Ranked for {taskLabels[profile.taskType]?.toLowerCase() || 'your task'} · {inputTokens.toLocaleString()} input tokens · {outputTokens.toLocaleString()} output tokens</p></div>
      {results.best ? <>
        <section className="best-card"><div className="best-left"><span className="best-kicker"><BadgeCheck size={14} /> TOP RECOMMENDATION</span><h2>{results.best.name}</h2><p>Strongest weighted fit for this prompt under your selected priorities.</p><div className="best-tags"><span>{Math.round(results.best.quality)} task fit</span><span>{Math.round(results.best.score)} Atlas score</span><span>{(results.best.contextWindow / 1000).toFixed(0)}k context</span></div></div><div className="best-cost"><small>ESTIMATED REQUEST COST</small><strong>{money(results.best.cost)}</strong><span>{money(results.best.cost * 1000)} per 1,000 requests</span></div></section>
        <div className="result-sidecards"><article className="side-result"><span className="side-icon cheap"><Wallet size={17} /></span><div><small>LOWEST ESTIMATED COST</small><b>{results.cheapest?.name}</b><span>{money(results.cheapest?.cost)} per request</span></div></article><article className="side-result"><span className="side-icon speed"><Zap size={17} /></span><div><small>HIGHEST SPEED PRIOR</small><b>{results.fastest?.name}</b><span>Family estimate · no live latency</span></div></article></div>
        <section className="monthly-card"><div className="monthly-title"><div><small>MONTHLY SPEND ESTIMATE</small><h2>Project your usage</h2></div><div className="volume-choices">{[{id:'100',label:'100'},{id:'1000',label:'1,000'},{id:'10000',label:'10,000'},{id:'custom',label:'Custom'}].map((v) => <button key={v.id} className={volumeChoice === v.id ? 'active' : ''} onClick={() => { setVolumeChoice(v.id); if (v.id !== 'custom') setRequestsPerDay(Number(v.id)); }}>{v.label}</button>)}</div></div>{volumeChoice === 'custom' && <label className="volume-custom">Requests per day<input type="number" min="1" value={requestsPerDay} onChange={(e) => setRequestsPerDay(Math.max(1, Number(e.target.value) || 1))} /></label>}<div className="monthly-metrics"><div><small>RECOMMENDED MODEL</small><b>{money(results.best.cost * requestsPerDay * 30)}<i> / month</i></b></div><div><small>LOWEST-COST OPTION</small><b>{money((results.cheapest?.cost || 0) * requestsPerDay * 30)}<i> / month</i></b></div><div className="savings"><small>ESTIMATED DIFFERENCE</small><b>{money(Math.max(0, (results.best.cost - (results.cheapest?.cost || 0)) * requestsPerDay * 30))}<i> / month</i></b></div></div></section>
        <section className="comparison-section"><div className="comparison-heading"><div><small>THE SHORTLIST</small><h2>Compare eligible models</h2></div><button className="sort-info" title="Task fit uses the prototype benchmark snapshot. Cost uses catalog prices and token estimates."><Info size={15} /> How scores work</button></div><div className="compare-header"><span>MODEL</span><span>TASK FIT <Info size={12} /></span><span>ESTIMATED COST</span><span>SCORE</span></div><div className="compare-list">{(allModels ? results.ranked : results.ranked.slice(0,6)).map((model,i)=><ModelRow key={model.id} model={model} index={i} selected={model.id===results.best.id} inputTokens={inputTokens} outputTokens={outputTokens} />)}</div>{results.ranked.length>6&&<button className="more-models" onClick={()=>setAllModels(!allModels)}>{allModels?'Show fewer':'Show all '+results.ranked.length+' models'}<ChevronDown size={15}/></button>}
          <div className="score-note"><Info size={15} /><p>Task fit and speed are illustrative family-level priors in this prototype, not live benchmark results. Prices and context windows use the OpenRouter catalog when a key is configured; otherwise, sample data is shown.</p></div>
        </section>
      </> : <section className="no-match"><Wallet size={26}/><h2>No models meet those limits.</h2><p>Raise the budget or choose “No limit” to see the full shortlist.</p><button className="btn btn-primary" onClick={()=>goTo(1)}>Adjust preferences <ArrowRight size={16}/></button></section>}
      <div className="results-actions"><button className="btn btn-light" onClick={()=>goTo(0)}><ArrowLeft size={15}/> Start over</button><button className="btn btn-light" onClick={()=>goTo(1)}>Change priorities</button></div>
    </main>}

    <footer className="product-footer"><span>MODEL ATLAS <i>·</i> A clearer way to choose an LLM</span><span><Cpu size={13}/>{catalogStatus === 'live' ? 'Live catalog' : 'Example catalog'} · Estimates are directional</span></footer>
  </div>;
}
