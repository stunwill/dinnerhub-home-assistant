const dhAiJson = async (path, options = {}) => {
  const response = await fetch(`api/${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || 'Request failed');
  return body;
};

const dhEsc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

const dhInstallLogo = () => {
  document.querySelectorAll('.dh-brand').forEach((brand) => {
    if (brand.querySelector('.dh-logo-image')) return;
    brand.innerHTML = '<img class="dh-logo-image" src="/dinnerhub-logo.svg" alt="FoodHub by Stu">';
  });
};

const dhCloseAi = () => document.querySelector('.dh-ai-backdrop')?.remove();

const dhModal = (kicker, title, body) => {
  dhCloseAi();
  const backdrop = document.createElement('div');
  backdrop.className = 'dh-ai-backdrop';
  backdrop.innerHTML = `<section class="dh-ai-modal" role="dialog" aria-modal="true">
    <div class="dh-ai-heading"><div><div class="dh-ai-kicker">${dhEsc(kicker)}</div><h2>${dhEsc(title)}</h2></div><button class="dh-ai-close" aria-label="Close">×</button></div>
    <div class="dh-ai-body">${body}</div>
  </section>`;
  backdrop.querySelector('.dh-ai-close').onclick = dhCloseAi;
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) dhCloseAi(); });
  document.body.appendChild(backdrop);
  return backdrop;
};

const dhSettingsModal = async () => {
  let settings;
  try { settings = await dhAiJson('ai/settings'); }
  catch (error) { settings = {configured:false, api_key_masked:'', api_base_url:'https://api.openai.com/v1', analysis_model:'gpt-4.1-mini', transcription_model:'gpt-4o-transcribe'}; }
  const modal = dhModal('AI CONFIGURATION', 'OpenAI settings', `
    <p>FoodHub stores the API key inside its persistent Home Assistant app data. The full key is never returned to the browser after it is saved.</p>
    <div class="dh-ai-grid">
      <label class="dh-ai-field full"><span>OpenAI API key</span><input id="dh-ai-key" type="password" autocomplete="off" placeholder="${settings.configured ? dhEsc(settings.api_key_masked) + ' (leave blank to keep)' : 'sk-…'}"></label>
      <label class="dh-ai-field full"><span>API base URL</span><input id="dh-ai-base" value="${dhEsc(settings.api_base_url)}"></label>
      <label class="dh-ai-field"><span>Recipe analysis model</span><input id="dh-ai-analysis" value="${dhEsc(settings.analysis_model)}"></label>
      <label class="dh-ai-field"><span>Transcription model</span><input id="dh-ai-transcription" value="${dhEsc(settings.transcription_model)}"></label>
    </div>
    <div class="dh-ai-status" id="dh-ai-settings-status">${settings.configured ? `API key configured: ${dhEsc(settings.api_key_masked)}` : 'No API key has been configured yet.'}</div>
    <div class="dh-ai-actions"><button id="dh-ai-test">Save & test</button><button class="primary" id="dh-ai-save">Save settings</button></div>`);

  const save = async () => {
    const payload = {
      api_key: modal.querySelector('#dh-ai-key').value || null,
      api_base_url: modal.querySelector('#dh-ai-base').value.trim(),
      analysis_model: modal.querySelector('#dh-ai-analysis').value.trim(),
      transcription_model: modal.querySelector('#dh-ai-transcription').value.trim()
    };
    const saved = await dhAiJson('ai/settings', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    modal.querySelector('#dh-ai-settings-status').textContent = `Saved. API key: ${saved.api_key_masked || 'not configured'}`;
    modal.querySelector('#dh-ai-key').value = '';
    return saved;
  };

  modal.querySelector('#dh-ai-save').onclick = async () => {
    try { await save(); } catch (error) { modal.querySelector('#dh-ai-settings-status').textContent = error.message; modal.querySelector('#dh-ai-settings-status').classList.add('dh-ai-error'); }
  };
  modal.querySelector('#dh-ai-test').onclick = async () => {
    const status = modal.querySelector('#dh-ai-settings-status');
    try { await save(); status.textContent = 'Testing OpenAI connection…'; const result = await dhAiJson('ai/settings/test', {method:'POST'}); status.textContent = result.message; status.classList.remove('dh-ai-error'); }
    catch (error) { status.textContent = error.message; status.classList.add('dh-ai-error'); }
  };
};

const dhReviewDraft = (draft) => {
  const categories = Array.isArray(draft.categories) ? draft.categories.join(', ') : '';
  const ingredientMarkup = (draft.ingredients || []).map((item) => `<li><strong>${dhEsc(item.quantity ?? '')} ${dhEsc(item.unit ?? '')}</strong> ${dhEsc(item.name)}${item.notes ? ` <small>(${dhEsc(item.notes)})</small>` : ''}</li>`).join('');
  const stepMarkup = (draft.steps || []).map((step, index) => `<li class="dh-ai-step"><strong>${index + 1}.</strong> ${dhEsc(step.instruction)}${step.ingredient_names?.length ? `<br><small>Uses: ${dhEsc(step.ingredient_names.join(', '))}</small>` : ''}</li>`).join('');
  const warningMarkup = draft.warnings?.length ? `<div class="dh-ai-warning"><strong>Check these AI uncertainties:</strong><ul>${draft.warnings.map((item) => `<li>${dhEsc(item)}</li>`).join('')}</ul></div>` : '';
  const modal = dhModal('AI RECIPE DRAFT', 'Review before saving', `
    ${warningMarkup}
    <div class="dh-ai-review">
      <div>${draft.image_data_url ? `<img src="${draft.image_data_url}" alt="Proposed recipe image">` : ''}<div class="dh-ai-note">Review every quantity and instruction before creating the recipe.</div></div>
      <div>
        <div class="dh-ai-grid">
          <label class="dh-ai-field full"><span>Meal name</span><input id="dh-draft-name" value="${dhEsc(draft.name)}"></label>
          <label class="dh-ai-field full"><span>Description</span><textarea id="dh-draft-description">${dhEsc(draft.description || '')}</textarea></label>
          <label class="dh-ai-field full"><span>Categories</span><input id="dh-draft-categories" value="${dhEsc(categories)}"></label>
          <label class="dh-ai-field"><span>Cuisine</span><input id="dh-draft-cuisine" value="${dhEsc(draft.cuisine || '')}"></label>
          <label class="dh-ai-field"><span>Difficulty</span><select id="dh-draft-difficulty"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
          <label class="dh-ai-field"><span>Prep minutes</span><input id="dh-draft-prep" type="number" min="0" value="${Number(draft.prep_minutes || 0)}"></label>
          <label class="dh-ai-field"><span>Cook minutes</span><input id="dh-draft-cook" type="number" min="0" value="${Number(draft.cook_minutes || 0)}"></label>
          <label class="dh-ai-field"><span>Servings</span><input id="dh-draft-servings" type="number" min="0.5" step="0.5" value="${Number(draft.servings || 4)}"></label>
        </div>
        <h3>Ingredients</h3><ul class="dh-ai-list">${ingredientMarkup || '<li>No ingredients detected.</li>'}</ul>
        <h3>Method</h3><ol class="dh-ai-list">${stepMarkup || '<li>No method detected.</li>'}</ol>
      </div>
    </div>
    <div class="dh-ai-status" id="dh-draft-status">Nothing is saved until you select Create recipe.</div>
    <div class="dh-ai-actions"><button id="dh-draft-cancel">Discard draft</button><button class="primary" id="dh-draft-save">Create recipe</button></div>`);
  modal.querySelector('#dh-draft-difficulty').value = draft.difficulty || 'easy';
  modal.querySelector('#dh-draft-cancel').onclick = dhCloseAi;
  modal.querySelector('#dh-draft-save').onclick = async () => {
    const status = modal.querySelector('#dh-draft-status');
    try {
      status.textContent = 'Creating recipe…';
      const payload = {
        name: modal.querySelector('#dh-draft-name').value.trim(),
        description: modal.querySelector('#dh-draft-description').value.trim() || null,
        main_protein: null,
        category: modal.querySelector('#dh-draft-categories').value.trim() || null,
        cuisine: modal.querySelector('#dh-draft-cuisine').value.trim() || null,
        prep_minutes: Number(modal.querySelector('#dh-draft-prep').value || 0),
        cook_minutes: Number(modal.querySelector('#dh-draft-cook').value || 0),
        servings: Number(modal.querySelector('#dh-draft-servings').value || 4),
        difficulty: modal.querySelector('#dh-draft-difficulty').value,
        instructions: (draft.steps || []).map((step) => step.instruction),
        dietary_tags: [], allergens: [], substitutions: [], notes: null,
        image_url: draft.image_data_url || null,
        source_url: draft.source_url || null,
        favourite: false, household_rating: null,
        ingredients: draft.ingredients || []
      };
      const created = await dhAiJson('meals', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      if (draft.steps?.length) {
        await dhAiJson(`meals/${created.id}/steps`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(draft.steps)});
      }
      status.textContent = `Created ${created.name}.`;
      window.setTimeout(() => { dhCloseAi(); window.location.reload(); }, 900);
    } catch (error) { status.textContent = error.message; status.classList.add('dh-ai-error'); }
  };
};

const dhImportModal = () => {
  const modal = dhModal('AI RECIPE IMPORT', 'Import a recipe from video', `
    <p>Upload a cooking video or provide a direct video URL. FoodHub extracts audio and representative frames, sends them to the configured OpenAI API, then presents a draft for review.</p>
    <div class="dh-ai-source-tabs"><button class="active" data-mode="upload">Upload video</button><button data-mode="url">Video URL</button></div>
    <div id="dh-ai-upload-panel"><label class="dh-ai-field"><span>Video file</span><input id="dh-ai-video" type="file" accept="video/*"></label><div class="dh-ai-note">Maximum 250 MB. Downloading an Instagram or Facebook video first is the most reliable option.</div></div>
    <div id="dh-ai-url-panel" hidden><label class="dh-ai-field"><span>Direct video URL</span><input id="dh-ai-url" type="url" placeholder="https://…"></label><div class="dh-ai-warning">Instagram and Facebook page links may not expose the video to automated requests. If retrieval fails, download the video and upload it here.</div></div>
    <div class="dh-ai-progress" id="dh-ai-progress"><span class="dh-ai-spinner"></span><span>Extracting media and analysing recipe… this can take a few minutes.</span></div>
    <div class="dh-ai-status" id="dh-ai-import-status">Your video is sent to your configured OpenAI API for transcription and recipe analysis.</div>
    <div class="dh-ai-actions"><button class="primary" id="dh-ai-analyse">Analyse recipe</button></div>`);
  let mode = 'upload';
  modal.querySelectorAll('[data-mode]').forEach((button) => button.onclick = () => {
    mode = button.dataset.mode;
    modal.querySelectorAll('[data-mode]').forEach((item) => item.classList.toggle('active', item === button));
    modal.querySelector('#dh-ai-upload-panel').hidden = mode !== 'upload';
    modal.querySelector('#dh-ai-url-panel').hidden = mode !== 'url';
  });
  modal.querySelector('#dh-ai-analyse').onclick = async () => {
    const status = modal.querySelector('#dh-ai-import-status');
    const progress = modal.querySelector('#dh-ai-progress');
    try {
      progress.classList.add('active'); status.textContent = 'Processing video…';
      let draft;
      if (mode === 'upload') {
        const file = modal.querySelector('#dh-ai-video').files[0];
        if (!file) throw new Error('Choose a video file first.');
        const form = new FormData(); form.append('file', file);
        draft = await dhAiJson('ai/import/video', {method:'POST', body:form});
      } else {
        const url = modal.querySelector('#dh-ai-url').value.trim();
        if (!url) throw new Error('Enter a video URL first.');
        draft = await dhAiJson('ai/import/url', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url})});
      }
      dhReviewDraft(draft);
    } catch (error) { progress.classList.remove('active'); status.textContent = error.message; status.classList.add('dh-ai-error'); }
  };
};

const dhInstallActions = () => {
  const header = document.querySelector('#root header');
  if (!header || header.querySelector('.dh-v010-actions')) return;
  const actions = document.createElement('div');
  actions.className = 'dh-v010-actions';
  actions.innerHTML = '<button type="button" id="dh-ai-settings-button">AI settings</button><button type="button" class="primary" id="dh-ai-import-button">Import recipe</button>';
  actions.querySelector('#dh-ai-settings-button').onclick = dhSettingsModal;
  actions.querySelector('#dh-ai-import-button').onclick = dhImportModal;
  header.appendChild(actions);
};

let dhAiApplying = false;
const dhInstallV010 = () => {
  if (dhAiApplying) return;
  dhAiApplying = true;
  try { dhInstallLogo(); dhInstallActions(); } finally { dhAiApplying = false; }
};
const dhAiObserver = new MutationObserver(() => requestAnimationFrame(dhInstallV010));
dhInstallV010();
dhAiObserver.observe(document.body, {childList:true, subtree:true});
