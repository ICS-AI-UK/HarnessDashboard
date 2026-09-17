// Shared data model: the same reading and validation rules are used by the
// local Node server (server.js) and the Netlify function (netlify/functions/data.js),
// so a deployed dashboard behaves exactly like the one you run on your machine.

export const DEFAULT_DATA = {
  stages: ['Not started', 'Discovery', 'Design', 'Build', 'Test', 'Deploy', 'Live'],
  projects: [],
  todos: [],
  links: [],
  notes: [],
};

export const PROGRESS_STATES = ['not-started', 'in-progress', 'complete'];

// Specification documents tracked per project, shown as the R S F T B circles.
export const DOC_KEYS = ['research', 'sme', 'functional', 'technical', 'buildPlan'];

// Lenient read of whatever is in storage: fills in anything missing so an older
// or hand-edited document still loads.
export function readDocument(parsed) {
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_DATA };
  return {
    stages:
      Array.isArray(parsed.stages) && parsed.stages.length ? parsed.stages : DEFAULT_DATA.stages,
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    todos: Array.isArray(parsed.todos) ? parsed.todos : [],
    links: Array.isArray(parsed.links) ? parsed.links : [],
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
  };
}

// Strict pass applied to everything written back.
export function sanitiseDocument(body) {
  const source = body && typeof body === 'object' ? body : {};
  const stages =
    Array.isArray(source.stages) && source.stages.length
      ? source.stages.map((s) => str(s, 40)).filter(Boolean)
      : DEFAULT_DATA.stages;

  return {
    stages,
    projects: (Array.isArray(source.projects) ? source.projects : []).map((p) =>
      sanitiseProject(p, stages)
    ),
    todos: (Array.isArray(source.todos) ? source.todos : []).map(sanitiseTodo),
    links: (Array.isArray(source.links) ? source.links : []).map(sanitiseLink),
    notes: (Array.isArray(source.notes) ? source.notes : []).map(sanitiseNote),
  };
}

export function sanitiseProject(raw, stages) {
  const wavesTotal = clampInt(raw.wavesTotal, 0, 999, 0);
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    name: str(raw.name, 120) || 'Untitled project',
    client: str(raw.client, 120),
    owner: str(raw.owner, 120),
    operator: str(raw.operator, 120),
    documents: safeUrl(raw.documents),
    docs: sanitiseDocs(raw.docs),
    status: raw.status === 'in-progress' ? 'in-progress' : 'other',
    stage: stages.includes(raw.stage) ? raw.stage : stages[0],
    wavesTotal,
    wavesComplete: clampInt(raw.wavesComplete, 0, wavesTotal, 0),
    notes: str(raw.notes, 1000),
    // The client stamps updatedAt when a project actually changes; keep it so a
    // save of unrelated projects doesn't make everything look freshly touched.
    updatedAt: isoDate(raw.updatedAt) || new Date().toISOString(),
  };
}

export function sanitiseDocs(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const docs = {};
  for (const key of DOC_KEYS) {
    docs[key] = PROGRESS_STATES.includes(src[key]) ? src[key] : 'not-started';
  }
  return docs;
}

export function sanitiseTodo(raw) {
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId('t'),
    name: str(raw.name, 200) || 'Untitled item',
    description: str(raw.description, 2000),
    assignedTo: str(raw.assignedTo, 120),
    state: PROGRESS_STATES.includes(raw.state) ? raw.state : 'not-started',
    updatedAt: isoDate(raw.updatedAt) || new Date().toISOString(),
  };
}

export function sanitiseLink(raw) {
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId('l'),
    label: str(raw.label, 200) || 'Untitled link',
    url: safeUrl(raw.url),
    description: str(raw.description, 500),
    updatedAt: isoDate(raw.updatedAt) || new Date().toISOString(),
  };
}

// Dashboard-level notes, distinct from a project's own notes field.
export function sanitiseNote(raw) {
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId('n'),
    title: str(raw.title, 200) || 'Untitled note',
    body: str(raw.body, 10000),
    updatedAt: isoDate(raw.updatedAt) || new Date().toISOString(),
  };
}

// Only http(s) survives: the client renders these straight into an href, so a
// javascript: or data: URL would otherwise be a stored XSS hole. The whitespace
// and hostname checks keep this in step with the browser, which would otherwise
// happily turn "not a url" into https://not%20a%20url/.
export function safeUrl(value) {
  const raw = str(value, 2000);
  if (!raw || /\s/.test(raw)) return '';
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return '';
    return url.href;
  } catch {
    return '';
  }
}

export function str(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function isoDate(value) {
  if (typeof value !== 'string') return '';
  const t = Date.parse(value);
  return Number.isNaN(t) ? '' : new Date(t).toISOString();
}

export function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function newId(prefix = 'p') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
