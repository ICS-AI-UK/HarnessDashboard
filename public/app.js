'use strict';

const API = '/api/data';

const PROGRESS_STATES = [
  { value: 'not-started', label: 'Not started' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'complete', label: 'Complete' },
];

// Pre-requisite documents, shown as the R S F T B circles on cards and rows.
const DOC_TYPES = [
  { key: 'research', letter: 'R', label: 'Research' },
  { key: 'sme', letter: 'S', label: 'SME Specification' },
  { key: 'functional', letter: 'F', label: 'Functional Specification' },
  { key: 'technical', letter: 'T', label: 'Technical Specification' },
  { key: 'buildPlan', letter: 'B', label: 'Build Plan' },
];

const state = {
  stages: [],
  projects: [],
  todos: [],
  links: [],
  notes: [],
};

const el = {
  saveState: document.getElementById('saveState'),
  addBtn: document.getElementById('addBtn'),
  inProgress: document.getElementById('inProgress'),
  inProgressEmpty: document.getElementById('inProgressEmpty'),
  inProgressCount: document.getElementById('inProgressCount'),
  otherBody: document.getElementById('otherBody'),
  otherWrap: document.getElementById('otherWrap'),
  otherEmpty: document.getElementById('otherEmpty'),
  otherCount: document.getElementById('otherCount'),
  dialog: document.getElementById('editDialog'),
  form: document.getElementById('editForm'),
  dialogTitle: document.getElementById('dialogTitle'),
  stageSelect: document.getElementById('stageSelect'),
  deleteBtn: document.getElementById('deleteBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  formError: document.getElementById('formError'),

  addTodoBtn: document.getElementById('addTodoBtn'),
  todoBody: document.getElementById('todoBody'),
  todoWrap: document.getElementById('todoWrap'),
  todoEmpty: document.getElementById('todoEmpty'),
  todoCount: document.getElementById('todoCount'),
  todoDialog: document.getElementById('todoDialog'),
  todoForm: document.getElementById('todoForm'),
  todoDialogTitle: document.getElementById('todoDialogTitle'),
  todoDeleteBtn: document.getElementById('todoDeleteBtn'),
  todoCancelBtn: document.getElementById('todoCancelBtn'),
  todoFormError: document.getElementById('todoFormError'),

  addLinkBtn: document.getElementById('addLinkBtn'),
  linkList: document.getElementById('linkList'),
  linkEmpty: document.getElementById('linkEmpty'),
  linkCount: document.getElementById('linkCount'),
  linkDialog: document.getElementById('linkDialog'),
  linkForm: document.getElementById('linkForm'),
  linkDialogTitle: document.getElementById('linkDialogTitle'),
  linkDeleteBtn: document.getElementById('linkDeleteBtn'),
  linkCancelBtn: document.getElementById('linkCancelBtn'),
  linkFormError: document.getElementById('linkFormError'),

  addNoteBtn: document.getElementById('addNoteBtn'),
  noteList: document.getElementById('noteList'),
  noteEmpty: document.getElementById('noteEmpty'),
  noteCount: document.getElementById('noteCount'),
  noteDialog: document.getElementById('noteDialog'),
  noteForm: document.getElementById('noteForm'),
  noteDialogTitle: document.getElementById('noteDialogTitle'),
  noteDeleteBtn: document.getElementById('noteDeleteBtn'),
  noteCancelBtn: document.getElementById('noteCancelBtn'),
  noteFormError: document.getElementById('noteFormError'),
};

let editingId = null;
let editingTodoId = null;
let editingLinkId = null;
let editingNoteId = null;

/* ---------- data ---------- */

async function load() {
  setStatus('Loading…');
  const res = await fetch(API);
  if (!res.ok) throw new Error(`Load failed (${res.status})`);
  adopt(await res.json());
  setStatus('');
  render();
}

async function save() {
  setStatus('Saving…');
  try {
    const res = await fetch(API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    if (!res.ok) throw new Error(`Save failed (${res.status})`);
    adopt(await res.json());
    setStatus(`Saved ${new Date().toLocaleTimeString()}`);
    render();
  } catch (err) {
    setStatus(err.message, true);
  }
}

function adopt(data) {
  state.stages = data.stages || [];
  state.projects = data.projects || [];
  state.todos = data.todos || [];
  state.links = data.links || [];
  state.notes = data.notes || [];
}

function setStatus(text, isError = false) {
  el.saveState.textContent = text;
  el.saveState.classList.toggle('error', isError);
}

function touch(record) {
  record.updatedAt = new Date().toISOString();
}

/* ---------- rendering ---------- */

function render() {
  const inProgress = state.projects.filter((p) => p.status === 'in-progress');
  const other = state.projects.filter((p) => p.status !== 'in-progress');

  el.inProgress.replaceChildren(...inProgress.map(buildCard));
  el.otherBody.replaceChildren(...other.map(buildRow));
  el.todoBody.replaceChildren(...state.todos.map(buildTodoRow));
  el.linkList.replaceChildren(...state.links.map(buildLinkItem));
  el.noteList.replaceChildren(...state.notes.map(buildNoteItem));

  el.inProgressCount.textContent = countLabel(inProgress.length, 'project');
  el.otherCount.textContent = countLabel(other.length, 'project');
  el.todoCount.textContent = countLabel(state.todos.length, 'item');
  el.linkCount.textContent = countLabel(state.links.length, 'link');
  el.noteCount.textContent = countLabel(state.notes.length, 'note');

  el.inProgressEmpty.hidden = inProgress.length > 0;
  el.otherEmpty.hidden = other.length > 0;
  el.todoEmpty.hidden = state.todos.length > 0;
  el.linkEmpty.hidden = state.links.length > 0;
  el.noteEmpty.hidden = state.notes.length > 0;

  el.otherWrap.hidden = other.length === 0;
  el.todoWrap.hidden = state.todos.length === 0;

  // Keyboard reordering re-renders the row, so put focus back on its handle.
  if (pendingFocusId) {
    const handle = document.querySelector(`[data-drag-id="${CSS.escape(pendingFocusId)}"] .drag-handle`);
    pendingFocusId = null;
    if (handle) handle.focus();
  }
}

function countLabel(n, noun) {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function peopleLine(p) {
  const parts = [];
  if (p.client) parts.push(p.client);
  if (p.owner) parts.push(`Owner: ${p.owner}`);
  if (p.operator) parts.push(`Operator: ${p.operator}`);
  return parts.length ? parts.join(' · ') : '—';
}

function docState(p, key) {
  return (p.docs && p.docs[key]) || 'not-started';
}

function docsComplete(p) {
  return DOC_TYPES.filter((d) => docState(p, d.key) === 'complete').length;
}

function buildDocDots(p) {
  const wrap = node('div', 'doc-dots');
  for (const doc of DOC_TYPES) {
    const value = docState(p, doc.key);
    const label = PROGRESS_STATES.find((s) => s.value === value)?.label || value;
    const dot = node('span', `doc-dot doc-${value}`, doc.letter);
    dot.title = `${doc.label} — ${label}`;
    dot.setAttribute('role', 'img');
    dot.setAttribute('aria-label', dot.title);
    wrap.append(dot);
  }
  return wrap;
}

function buildCard(p) {
  const total = p.wavesTotal || 0;
  const done = Math.min(p.wavesComplete || 0, total);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done === total;

  const card = node('div', 'card');

  const head = node('div', 'card-head');
  const titleWrap = node('div');
  titleWrap.append(node('h3', null, p.name));
  titleWrap.append(node('p', 'meta', peopleLine(p)));
  head.append(titleWrap, node('span', complete ? 'badge done' : 'badge', p.stage));
  card.append(head);

  const progress = node('div', 'progress-blocks');

  // Block 0: pre-requisite documents.
  const docs = node('div', 'progress-block');
  const docsLabel = node('div', 'progress-label');
  docsLabel.append(node('span', 'progress-title', 'Specification Docs'));
  docsLabel.append(node('span', 'progress-value', `${docsComplete(p)} of ${DOC_TYPES.length} complete`));
  docs.append(docsLabel, buildDocDots(p));
  progress.append(docs);

  // Block 1: overall progress (green bar).
  const overall = node('div', 'progress-block');
  const overallLabel = node('div', 'progress-label');
  overallLabel.append(node('span', 'progress-title', 'Build Progress'));
  overallLabel.append(node('span', 'progress-value', total ? `${pct}%` : '—'));
  overall.append(overallLabel);

  const track = node('div', 'track');
  const fill = node('div', 'fill');
  fill.style.width = `${pct}%`;
  track.append(fill);
  overall.append(track);
  progress.append(overall);

  // Block 2: waves complete (blue pips).
  const waves = node('div', 'progress-block');
  const wavesLabel = node('div', 'progress-label');
  wavesLabel.append(node('span', 'progress-title', 'Waves complete'));
  wavesLabel.append(
    node('span', 'progress-value', total ? `${done} of ${total}${complete ? '' : ` · on wave ${done + 1}`}` : 'No waves set')
  );
  waves.append(wavesLabel);

  // Beyond ~24 waves the pips get too thin to read; the label carries the count.
  if (total > 0 && total <= 24) {
    const pips = node('div', 'waves');
    for (let i = 0; i < total; i++) {
      const pip = node('div', i < done ? 'wave-pip on' : 'wave-pip');
      pip.title = `Wave ${i + 1}${i < done ? ' — complete' : ''}`;
      pips.append(pip);
    }
    waves.append(pips);
  }
  progress.append(waves);
  card.append(progress);

  if (p.notes) card.append(node('p', 'note', p.notes));

  const foot = node('div', 'card-foot');
  const minus = button('−', 'btn btn-step', () => stepWave(p, -1));
  minus.title = 'Mark a wave incomplete';
  minus.disabled = done <= 0;
  const plus = button('+', 'btn btn-step', () => stepWave(p, 1));
  plus.title = 'Complete the next wave';
  plus.disabled = total === 0 || done >= total;
  foot.append(minus, plus, node('span', 'spacer'));
  foot.append(node('span', 'meta', `Updated ${formatDate(p.updatedAt)}`));
  if (p.documents) foot.append(externalLink(p.documents, 'Documents', 'btn'));
  foot.append(button('Edit', 'btn', () => openDialog(p.id)));
  card.append(foot);

  return card;
}

function buildRow(p) {
  const tr = node('tr');
  tr.draggable = true;
  tr.dataset.dragId = p.id;
  tr.append(dragCell());
  tr.append(node('td', null, p.name));
  tr.append(node('td', null, p.owner || '—'));
  tr.append(node('td', null, p.operator || '—'));

  const prereqCell = node('td');
  prereqCell.append(buildDocDots(p));
  tr.append(prereqCell);

  const docsCell = node('td');
  if (p.documents) {
    docsCell.append(externalLink(p.documents, 'Open'));
  } else {
    docsCell.textContent = '—';
  }
  tr.append(docsCell);

  const stageCell = node('td');
  stageCell.append(
    dropdown(
      state.stages.map((s) => ({ value: s, label: s })),
      p.stage,
      (value) => {
        p.stage = value;
        touch(p);
        save();
      }
    )
  );
  tr.append(stageCell);

  const wavesCell = node('td');
  const total = p.wavesTotal || 0;
  const done = Math.min(p.wavesComplete || 0, total);
  if (total > 0) {
    const wrap = node('span', 'mini-track');
    const track = node('div', 'track');
    const fill = node('div', 'fill');
    fill.style.width = `${Math.round((done / total) * 100)}%`;
    track.append(fill);
    wrap.append(track, node('span', null, `${done}/${total}`));
    wavesCell.append(wrap);
  } else {
    wavesCell.textContent = '—';
  }
  tr.append(wavesCell);

  tr.append(node('td', null, formatDate(p.updatedAt)));

  const actions = node('td', 'col-actions');
  actions.append(
    button('Start', 'btn', () => {
      p.status = 'in-progress';
      touch(p);
      save();
    })
  );
  actions.append(document.createTextNode(' '));
  actions.append(button('Edit', 'btn', () => openDialog(p.id)));
  tr.append(actions);

  return tr;
}

function stepWave(p, delta) {
  const total = p.wavesTotal || 0;
  p.wavesComplete = Math.min(total, Math.max(0, (p.wavesComplete || 0) + delta));
  touch(p);
  save();
}

function buildTodoRow(t) {
  const tr = node('tr');
  if (t.state === 'complete') tr.className = 'todo-done';
  tr.draggable = true;
  tr.dataset.dragId = t.id;

  tr.append(dragCell());
  tr.append(node('td', null, t.name));
  tr.append(node('td', 'cell-wrap', t.description || '—'));
  tr.append(node('td', null, t.assignedTo || '—'));

  const stateCell = node('td');
  const select = dropdown(PROGRESS_STATES, t.state, (value) => {
    t.state = value;
    touch(t);
    save();
  });
  select.className = `state-select state-${t.state}`;
  stateCell.append(select);
  tr.append(stateCell);

  tr.append(node('td', null, formatDate(t.updatedAt)));

  const actions = node('td', 'col-actions');
  actions.append(button('Edit', 'btn', () => openTodoDialog(t.id)));
  tr.append(actions);

  return tr;
}

function buildLinkItem(l) {
  const li = node('li', 'link-item');

  const textWrap = node('div', 'link-text');
  if (l.url) {
    textWrap.append(externalLink(l.url, l.label));
    textWrap.append(node('span', 'link-url', l.url));
  } else {
    textWrap.append(node('strong', null, l.label));
    textWrap.append(node('span', 'link-url', 'No valid URL'));
  }
  if (l.description) textWrap.append(node('span', 'meta', l.description));
  li.append(textWrap);

  const actions = node('div', 'link-actions');
  actions.append(button('Edit', 'btn', () => openLinkDialog(l.id)));
  actions.append(
    button('Remove', 'btn btn-danger', () => {
      if (!confirm(`Remove the link "${l.label}"?`)) return;
      state.links = state.links.filter((x) => x.id !== l.id);
      save();
    })
  );
  li.append(actions);

  return li;
}

/* ---------- reordering ---------- */

let draggingRow = null;
let pendingFocusId = null;

function dragCell() {
  const td = node('td', 'col-drag');
  const handle = node('button', 'drag-handle', '⠿');
  handle.type = 'button';
  handle.title = 'Drag to reorder, or focus and use the up/down arrow keys';
  handle.setAttribute('aria-label', 'Reorder row');
  td.append(handle);
  return td;
}

// Rows are reordered in the DOM as you drag; on drop the new order is read back
// off the rows' data-drag-id and applied to the underlying array.
function makeSortable(tbody, applyOrder) {
  const currentIds = () => [...tbody.children].map((tr) => tr.dataset.dragId);

  tbody.addEventListener('dragstart', (event) => {
    const tr = event.target.closest('tr');
    if (!tr) return;
    draggingRow = tr;
    tr.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', tr.dataset.dragId || '');
  });

  tbody.addEventListener('dragover', (event) => {
    if (!draggingRow || draggingRow.parentElement !== tbody) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const target = event.target.closest('tr');
    if (!target || target === draggingRow || target.parentElement !== tbody) return;
    const box = target.getBoundingClientRect();
    const after = event.clientY - box.top > box.height / 2;
    tbody.insertBefore(draggingRow, after ? target.nextSibling : target);
  });

  tbody.addEventListener('drop', (event) => event.preventDefault());

  tbody.addEventListener('dragend', () => {
    if (!draggingRow) return;
    draggingRow.classList.remove('dragging');
    draggingRow = null;
    applyOrder(currentIds());
  });

  tbody.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const handle = event.target.closest('.drag-handle');
    if (!handle) return;
    const tr = handle.closest('tr');
    const ids = currentIds();
    const from = ids.indexOf(tr.dataset.dragId);
    const to = from + (event.key === 'ArrowUp' ? -1 : 1);
    if (from < 0 || to < 0 || to >= ids.length) return;
    event.preventDefault();
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    pendingFocusId = tr.dataset.dragId;
    applyOrder(ids);
  });
}

function sortByIds(list, ids) {
  const byId = new Map(list.map((item) => [item.id, item]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
  // Anything not in the DOM (shouldn't happen) keeps its place at the end.
  for (const item of list) if (!ids.includes(item.id)) ordered.push(item);
  return ordered;
}

function sameOrder(before, after) {
  return before.length === after.length && before.every((item, i) => item === after[i]);
}

function applyTodoOrder(ids) {
  const reordered = sortByIds(state.todos, ids);
  if (sameOrder(state.todos, reordered)) return render();
  state.todos = reordered;
  save();
}

// The table shows only the "other" projects, so the reordered subset is written
// back into the slots those projects occupy in the full list.
function applyOtherProjectOrder(ids) {
  const slots = [];
  state.projects.forEach((p, i) => {
    if (p.status !== 'in-progress') slots.push(i);
  });
  const reordered = sortByIds(
    slots.map((i) => state.projects[i]),
    ids
  );
  if (sameOrder(slots.map((i) => state.projects[i]), reordered)) return render();
  slots.forEach((slot, i) => {
    state.projects[slot] = reordered[i];
  });
  save();
}

makeSortable(el.otherBody, applyOtherProjectOrder);
makeSortable(el.todoBody, applyTodoOrder);

function buildNoteItem(n) {
  const li = node('li', 'note-item');

  const head = node('div', 'note-head');
  head.append(node('h3', null, n.title));
  head.append(node('span', 'spacer'));
  head.append(node('span', 'meta', `Updated ${formatDate(n.updatedAt)}`));
  head.append(button('Edit', 'btn', () => openNoteDialog(n.id)));
  li.append(head);

  if (n.body) li.append(node('p', 'note-body', n.body));

  return li;
}

/* ---------- project dialog ---------- */

// One "Not started / In progress / Complete" picker per pre-requisite document.
document.getElementById('docsGrid').replaceChildren(
  ...DOC_TYPES.map((doc) => {
    const label = document.createElement('label');
    label.append(document.createTextNode(`${doc.letter} · ${doc.label}`));
    const select = document.createElement('select');
    select.name = `doc_${doc.key}`;
    for (const state of PROGRESS_STATES) {
      const option = document.createElement('option');
      option.value = state.value;
      option.textContent = state.label;
      select.append(option);
    }
    label.append(select);
    return label;
  })
);

function openDialog(id) {
  editingId = id;
  const p = id ? state.projects.find((x) => x.id === id) : null;

  el.stageSelect.replaceChildren(
    ...state.stages.map((stage) => {
      const opt = document.createElement('option');
      opt.value = stage;
      opt.textContent = stage;
      return opt;
    })
  );

  el.dialogTitle.textContent = p ? 'Edit project' : 'Add project';
  el.deleteBtn.hidden = !p;
  el.formError.hidden = true;

  const f = el.form.elements;
  f.name.value = p ? p.name : '';
  f.client.value = p ? p.client : '';
  f.owner.value = p ? p.owner : '';
  f.operator.value = p ? p.operator || '' : '';
  f.documents.value = p ? p.documents || '' : '';
  for (const doc of DOC_TYPES) {
    f[`doc_${doc.key}`].value = p ? docState(p, doc.key) : 'not-started';
  }
  f.status.value = p ? p.status : 'in-progress';
  f.stage.value = p ? p.stage : state.stages[0];
  f.wavesComplete.value = p ? p.wavesComplete : 0;
  f.wavesTotal.value = p ? p.wavesTotal : 0;
  f.notes.value = p ? p.notes : '';

  el.dialog.showModal();
  f.name.focus();
}

el.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const f = el.form.elements;

  const name = f.name.value.trim();
  if (!name) return showError(el.formError, 'Project name is required.');

  const wavesTotal = Math.max(0, Number.parseInt(f.wavesTotal.value, 10) || 0);
  const wavesComplete = Math.max(0, Number.parseInt(f.wavesComplete.value, 10) || 0);
  if (wavesComplete > wavesTotal) {
    return showError(el.formError, 'Waves complete cannot be greater than waves total.');
  }

  const documents = f.documents.value.trim();
  if (documents && !isWebUrl(documents)) {
    return showError(el.formError, 'Documents link must be a web address, for example https://example.com.');
  }

  const docs = {};
  for (const doc of DOC_TYPES) docs[doc.key] = f[`doc_${doc.key}`].value;

  const values = {
    name,
    client: f.client.value.trim(),
    owner: f.owner.value.trim(),
    operator: f.operator.value.trim(),
    documents,
    docs,
    status: f.status.value,
    stage: f.stage.value,
    wavesTotal,
    wavesComplete,
    notes: f.notes.value.trim(),
  };

  const existing = editingId ? state.projects.find((p) => p.id === editingId) : null;
  if (existing) {
    Object.assign(existing, values);
    touch(existing);
  } else {
    state.projects.push({ id: '', ...values, updatedAt: new Date().toISOString() });
  }

  el.dialog.close();
  save();
});

el.deleteBtn.addEventListener('click', () => {
  const p = state.projects.find((x) => x.id === editingId);
  if (!p) return;
  if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
  state.projects = state.projects.filter((x) => x.id !== editingId);
  el.dialog.close();
  save();
});

el.cancelBtn.addEventListener('click', () => el.dialog.close());
el.addBtn.addEventListener('click', () => openDialog(null));

/* ---------- to do dialog ---------- */

function openTodoDialog(id) {
  editingTodoId = id;
  const t = id ? state.todos.find((x) => x.id === id) : null;

  el.todoDialogTitle.textContent = t ? 'Edit to do item' : 'Add to do item';
  el.todoDeleteBtn.hidden = !t;
  el.todoFormError.hidden = true;

  const f = el.todoForm.elements;
  f.name.value = t ? t.name : '';
  f.description.value = t ? t.description : '';
  f.assignedTo.value = t ? t.assignedTo : '';
  f.state.value = t ? t.state : 'not-started';

  el.todoDialog.showModal();
  f.name.focus();
}

el.todoForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const f = el.todoForm.elements;

  const name = f.name.value.trim();
  if (!name) return showError(el.todoFormError, 'Item name is required.');

  const values = {
    name,
    description: f.description.value.trim(),
    assignedTo: f.assignedTo.value.trim(),
    state: f.state.value,
  };

  const existing = editingTodoId ? state.todos.find((t) => t.id === editingTodoId) : null;
  if (existing) {
    Object.assign(existing, values);
    touch(existing);
  } else {
    state.todos.push({ id: '', ...values, updatedAt: new Date().toISOString() });
  }

  el.todoDialog.close();
  save();
});

el.todoDeleteBtn.addEventListener('click', () => {
  const t = state.todos.find((x) => x.id === editingTodoId);
  if (!t) return;
  if (!confirm(`Delete the item "${t.name}"? This cannot be undone.`)) return;
  state.todos = state.todos.filter((x) => x.id !== editingTodoId);
  el.todoDialog.close();
  save();
});

el.todoCancelBtn.addEventListener('click', () => el.todoDialog.close());
el.addTodoBtn.addEventListener('click', () => openTodoDialog(null));

/* ---------- link dialog ---------- */

function openLinkDialog(id) {
  editingLinkId = id;
  const l = id ? state.links.find((x) => x.id === id) : null;

  el.linkDialogTitle.textContent = l ? 'Edit link' : 'Add link';
  el.linkDeleteBtn.hidden = !l;
  el.linkFormError.hidden = true;

  const f = el.linkForm.elements;
  f.label.value = l ? l.label : '';
  f.url.value = l ? l.url : '';
  f.description.value = l ? l.description : '';

  el.linkDialog.showModal();
  f.label.focus();
}

el.linkForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const f = el.linkForm.elements;

  const label = f.label.value.trim();
  if (!label) return showError(el.linkFormError, 'Label is required.');

  const url = f.url.value.trim();
  if (!isWebUrl(url)) {
    return showError(el.linkFormError, 'Enter a web address, for example https://example.com.');
  }

  const values = { label, url, description: f.description.value.trim() };

  const existing = editingLinkId ? state.links.find((l) => l.id === editingLinkId) : null;
  if (existing) {
    Object.assign(existing, values);
    touch(existing);
  } else {
    state.links.push({ id: '', ...values, updatedAt: new Date().toISOString() });
  }

  el.linkDialog.close();
  save();
});

el.linkDeleteBtn.addEventListener('click', () => {
  const l = state.links.find((x) => x.id === editingLinkId);
  if (!l) return;
  if (!confirm(`Remove the link "${l.label}"?`)) return;
  state.links = state.links.filter((x) => x.id !== editingLinkId);
  el.linkDialog.close();
  save();
});

el.linkCancelBtn.addEventListener('click', () => el.linkDialog.close());
el.addLinkBtn.addEventListener('click', () => openLinkDialog(null));

/* ---------- note dialog ---------- */

function openNoteDialog(id) {
  editingNoteId = id;
  const n = id ? state.notes.find((x) => x.id === id) : null;

  el.noteDialogTitle.textContent = n ? 'Edit note' : 'Add note';
  el.noteDeleteBtn.hidden = !n;
  el.noteFormError.hidden = true;

  const f = el.noteForm.elements;
  f.title.value = n ? n.title : '';
  f.body.value = n ? n.body : '';

  el.noteDialog.showModal();
  f.title.focus();
}

el.noteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const f = el.noteForm.elements;

  const title = f.title.value.trim();
  if (!title) return showError(el.noteFormError, 'Title is required.');

  const values = { title, body: f.body.value.trim() };

  const existing = editingNoteId ? state.notes.find((n) => n.id === editingNoteId) : null;
  if (existing) {
    Object.assign(existing, values);
    touch(existing);
  } else {
    state.notes.push({ id: '', ...values, updatedAt: new Date().toISOString() });
  }

  el.noteDialog.close();
  save();
});

el.noteDeleteBtn.addEventListener('click', () => {
  const n = state.notes.find((x) => x.id === editingNoteId);
  if (!n) return;
  if (!confirm(`Delete the note "${n.title}"? This cannot be undone.`)) return;
  state.notes = state.notes.filter((x) => x.id !== editingNoteId);
  el.noteDialog.close();
  save();
});

el.noteCancelBtn.addEventListener('click', () => el.noteDialog.close());
el.addNoteBtn.addEventListener('click', () => openNoteDialog(null));

/* ---------- helpers ---------- */

// Mirrors the server's safeUrl check so bad input is caught before saving —
// including the whitespace and hostname rules, without which the browser would
// accept "not a url" and the server would then quietly store nothing.
function isWebUrl(value) {
  if (!value || /\s/.test(value)) return false;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.hostname.includes('.') || url.hostname === 'localhost';
  } catch {
    return false;
  }
}

function node(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

function externalLink(url, label, className) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = label;
  a.title = url;
  if (className) a.className = className;
  return a;
}

function button(label, className, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function dropdown(options, selected, onChange) {
  const select = document.createElement('select');
  for (const opt of options) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    option.selected = opt.value === selected;
    select.append(option);
  }
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function showError(target, message) {
  target.textContent = message;
  target.hidden = false;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

load().catch((err) => setStatus(err.message, true));
