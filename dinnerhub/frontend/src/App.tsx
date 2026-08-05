import { ChangeEvent, FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Ingredient = {
  id?: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  shopping_category: string;
  notes?: string | null;
  optional?: boolean;
};

type Meal = {
  id: number;
  name: string;
  description: string | null;
  main_protein: string | null;
  category: string | null;
  cuisine: string | null;
  prep_minutes: number;
  cook_minutes: number;
  total_minutes: number;
  servings: number;
  difficulty: string;
  instructions: string[];
  dietary_tags: string[];
  allergens: string[];
  substitutions: string[];
  notes: string | null;
  image_url: string | null;
  source_url: string | null;
  favourite: boolean;
  household_rating: number | null;
  ingredients: Ingredient[];
  active: boolean;
};

type IngredientDraft = {
  key: string;
  name: string;
  quantity: string;
  unit: string;
};

type PlanEntry = {
  id: number;
  meal_date: string;
  meal_id: number | null;
  title: string;
  entry_type: string;
  status: string;
  servings: number | null;
  meal: Meal | null;
};

type Dashboard = {
  version: string;
  today: PlanEntry | null;
  tomorrow: PlanEntry | null;
  upcoming: PlanEntry[];
  unplanned_days: number;
  active_meals: number;
};

type View = 'dashboard' | 'meals' | 'plan';

const api = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`api/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Request failed');
  }
  return response.status === 204 ? (undefined as T) : response.json();
};

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, {
  weekday: 'short', day: 'numeric', month: 'short'
}).format(new Date(`${value}T12:00:00`));

const isoDate = (offset: number) => {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
};

const splitCategories = (value: string | null) =>
  (value || '').split(',').map((item) => item.trim()).filter(Boolean);

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
const draftKey = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const resizeImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
  if (!file.type.startsWith('image/')) {
    reject(new Error('Please select an image file'));
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    reject(new Error('Image must be smaller than 12 MB'));
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Image could not be read'));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('Image could not be opened'));
    image.onload = () => {
      const max = 1200;
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Image processing is unavailable'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});

const mealPayload = (meal: Meal, overrides: Partial<Meal> = {}) => ({
  name: overrides.name ?? meal.name,
  description: overrides.description ?? meal.description,
  main_protein: null,
  category: overrides.category ?? meal.category,
  cuisine: overrides.cuisine ?? meal.cuisine,
  prep_minutes: overrides.prep_minutes ?? meal.prep_minutes,
  cook_minutes: overrides.cook_minutes ?? meal.cook_minutes,
  servings: overrides.servings ?? meal.servings,
  difficulty: overrides.difficulty ?? meal.difficulty,
  instructions: overrides.instructions ?? meal.instructions,
  dietary_tags: overrides.dietary_tags ?? meal.dietary_tags,
  allergens: overrides.allergens ?? meal.allergens,
  substitutions: overrides.substitutions ?? meal.substitutions,
  notes: overrides.notes ?? meal.notes,
  image_url: overrides.image_url ?? meal.image_url,
  source_url: overrides.source_url ?? meal.source_url,
  favourite: overrides.favourite ?? meal.favourite,
  household_rating: overrides.household_rating ?? meal.household_rating,
  ingredients: overrides.ingredients ?? meal.ingredients,
  active: overrides.active ?? meal.active
});

function App() {
  const [view, setView] = useState<View>('dashboard');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [plan, setPlan] = useState<PlanEntry[]>([]);
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showMealForm, setShowMealForm] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [detailServings, setDetailServings] = useState(4);
  const [planningMeal, setPlanningMeal] = useState<Meal | null>(null);
  const [planningDays, setPlanningDays] = useState(14);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [ingredientRows, setIngredientRows] = useState<IngredientDraft[]>([]);
  const [imageData, setImageData] = useState<string | null>(null);
  const [processingImage, setProcessingImage] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const planDays = Math.max(days, planningDays);
      const [dashboardData, mealData, planData] = await Promise.all([
        api<Dashboard>(`dashboard?days=${days}`),
        api<Meal[]>('meals'),
        api<PlanEntry[]>(`meal-plan?start=${isoDate(0)}&days=${planDays}`)
      ]);
      setDashboard(dashboardData);
      setMeals(mealData);
      setPlan(planData);
      if (selectedMeal) {
        const refreshed = mealData.find((meal) => meal.id === selectedMeal.id) || null;
        setSelectedMeal(refreshed);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'DinnerHub could not load');
    }
  }, [days, planningDays, selectedMeal?.id]);

  useEffect(() => { void load(); }, [load]);

  const ingredientOptions = useMemo(() => Array.from(new Set(
    meals.flatMap((meal) => meal.ingredients.map((item) => item.name))
  )).sort((a, b) => a.localeCompare(b)), [meals]);

  const categoryOptions = useMemo(() => Array.from(new Set(
    meals.flatMap((meal) => splitCategories(meal.category))
  )).sort((a, b) => a.localeCompare(b)), [meals]);

  const categorySuggestions = useMemo(() => {
    const term = categoryInput.toLowerCase().trim();
    return categoryOptions
      .filter((item) => !selectedCategories.some((selected) => selected.toLowerCase() === item.toLowerCase()))
      .filter((item) => !term || item.toLowerCase().includes(term))
      .slice(0, 8);
  }, [categoryInput, categoryOptions, selectedCategories]);

  const filteredMeals = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return meals;
    return meals.filter((meal) => [
      meal.name,
      meal.category,
      ...meal.ingredients.map((item) => item.name)
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [meals, search]);

  const planByDate = useMemo(() => new Map(plan.map((entry) => [entry.meal_date, entry])), [plan]);

  const addCategory = (raw: string) => {
    const value = normalize(raw);
    if (!value) return;
    if (!selectedCategories.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setSelectedCategories((current) => [...current, value]);
    }
    setCategoryInput('');
  };

  const handleCategoryKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addCategory(categoryInput);
    }
  };

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProcessingImage(true);
    try {
      setImageData(await resizeImage(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Image could not be processed');
    } finally {
      setProcessingImage(false);
    }
  };

  const emptyIngredient = (): IngredientDraft => ({ key: draftKey(), name: '', quantity: '', unit: '' });

  const openCreateForm = () => {
    setEditingMeal(null);
    setSelectedCategories([]);
    setCategoryInput('');
    setIngredientRows([emptyIngredient()]);
    setImageData(null);
    setShowMealForm(true);
  };

  const openEditForm = (meal: Meal) => {
    setEditingMeal(meal);
    setSelectedCategories(splitCategories(meal.category));
    setCategoryInput('');
    setIngredientRows(meal.ingredients.length ? meal.ingredients.map((ingredient) => ({
      key: draftKey(),
      name: ingredient.name,
      quantity: ingredient.quantity === null ? '' : String(ingredient.quantity),
      unit: ingredient.unit || ''
    })) : [emptyIngredient()]);
    setImageData(meal.image_url);
    setSelectedMeal(null);
    setShowMealForm(true);
  };

  const resetMealForm = () => {
    setShowMealForm(false);
    setEditingMeal(null);
    setSelectedCategories([]);
    setCategoryInput('');
    setIngredientRows([]);
    setImageData(null);
  };

  const updateIngredientRow = (key: string, field: keyof Omit<IngredientDraft, 'key'>, value: string) => {
    setIngredientRows((current) => current.map((row) => row.key === key ? { ...row, [field]: value } : row));
  };

  const saveMeal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ingredients = ingredientRows
      .map((row) => ({ ...row, name: normalize(row.name) }))
      .filter((row) => row.name);
    if (!ingredients.length) {
      setError('Add at least one ingredient');
      return;
    }
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get('name'),
      description: form.get('description') || null,
      main_protein: null,
      category: selectedCategories.join(', ') || null,
      cuisine: form.get('cuisine') || null,
      prep_minutes: Number(form.get('prep') || 0),
      cook_minutes: Number(form.get('cook') || 0),
      servings: Number(form.get('servings') || 4),
      difficulty: form.get('difficulty') || 'easy',
      image_url: imageData,
      source_url: form.get('source_url') || null,
      notes: form.get('notes') || null,
      ingredients: ingredients.map((row) => ({
        name: row.name,
        quantity: row.quantity === '' ? null : Number(row.quantity),
        unit: row.unit || null,
        shopping_category: 'Other',
        notes: null,
        optional: false
      })),
      instructions: String(form.get('instructions') || '')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      dietary_tags: editingMeal?.dietary_tags || [],
      allergens: editingMeal?.allergens || [],
      substitutions: editingMeal?.substitutions || [],
      favourite: editingMeal?.favourite || false,
      household_rating: editingMeal?.household_rating || null,
      active: true
    };
    try {
      await api<Meal>(editingMeal ? `meals/${editingMeal.id}` : 'meals', {
        method: editingMeal ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
      resetMealForm();
      setMessage(editingMeal ? 'Recipe updated' : 'Recipe added');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Recipe could not be saved');
    }
  };

  const toggleFavourite = async (meal: Meal) => {
    try {
      const updated = await api<Meal>(`meals/${meal.id}`, {
        method: 'PUT',
        body: JSON.stringify(mealPayload(meal, { favourite: !meal.favourite }))
      });
      setSelectedMeal(updated);
      setMessage(updated.favourite ? 'Added to favourites' : 'Removed from favourites');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Favourite could not be updated');
    }
  };

  const archiveMeal = async (meal: Meal) => {
    if (!window.confirm(`Archive ${meal.name}? It will be removed from the active recipe list.`)) return;
    try {
      await api<void>(`meals/${meal.id}`, { method: 'DELETE' });
      setSelectedMeal(null);
      setMessage('Recipe archived');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Recipe could not be archived');
    }
  };

  const assignMeal = async (mealDate: string, mealId: number | null, entryType = 'meal') => {
    setSavingDate(mealDate);
    try {
      if (!mealId && entryType === 'meal') {
        const response = await fetch(`api/meal-plan/${mealDate}`, { method: 'DELETE' });
        if (!response.ok && response.status !== 404) throw new Error('Meal could not be removed');
      } else {
        await api<PlanEntry>(`meal-plan/${mealDate}`, {
          method: 'PUT',
          body: JSON.stringify({ meal_id: mealId, entry_type: entryType })
        });
      }
      setMessage('Meal plan updated');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Meal plan could not be updated');
    } finally {
      setSavingDate(null);
    }
  };

  const exportShoppingList = () => {
    const selectedPlan = Array.from({ length: days }, (_, offset) => planByDate.get(isoDate(offset)))
      .filter((entry): entry is PlanEntry => Boolean(entry?.meal));
    const rows = new Map<string, { name: string; quantity: number; hasQuantity: boolean; unit: string; meals: Set<string> }>();
    selectedPlan.forEach((entry) => {
      const servingMultiplier = entry.servings && entry.meal?.servings ? entry.servings / entry.meal.servings : 1;
      entry.meal?.ingredients.forEach((ingredient) => {
        const key = `${ingredient.name.toLowerCase()}|${ingredient.unit || ''}`;
        const current = rows.get(key) || {
          name: ingredient.name,
          quantity: 0,
          hasQuantity: false,
          unit: ingredient.unit || '',
          meals: new Set<string>()
        };
        if (ingredient.quantity !== null) {
          current.quantity += ingredient.quantity * servingMultiplier;
          current.hasQuantity = true;
        }
        current.meals.add(entry.title);
        rows.set(key, current);
      });
    });
    if (!rows.size) {
      setError(`No recipe ingredients are available in the next ${days} days`);
      return;
    }
    const csv = [
      ['Ingredient', 'Quantity', 'Unit', 'Meals'],
      ...Array.from(rows.values())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((value) => [
          value.name,
          value.hasQuantity ? String(Number(value.quantity.toFixed(2))) : '',
          value.unit,
          Array.from(value.meals).join('; ')
        ])
    ].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dinnerhub-shopping-list-${isoDate(0)}-${days}-days.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Shopping list exported');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Plan dinner. Shop smarter. Eat better.</div>
          <h1>DinnerHub</h1>
        </div>
        <button className="primary" onClick={openCreateForm}>Add recipe</button>
      </header>

      <nav className="tabs" aria-label="DinnerHub navigation">
        {(['dashboard', 'meals', 'plan'] as View[]).map((item) => (
          <button key={item} className={view === item ? 'active' : ''} onClick={() => setView(item)}>
            {item === 'dashboard' ? 'Home' : item === 'meals' ? 'Meals' : 'Meal plan'}
          </button>
        ))}
      </nav>

      {error && <div className="notice error">{error}<button onClick={() => setError('')}>×</button></div>}
      {message && <div className="notice success">{message}<button onClick={() => setMessage('')}>×</button></div>}

      <main>
        {view === 'dashboard' && (
          <>
            <section className="hero-grid">
              <article className="feature-card tonight">
                <span>Tonight</span>
                <h2>{dashboard?.today?.title || 'Nothing planned yet'}</h2>
                <p>{dashboard?.today?.meal
                  ? `${dashboard.today.meal.total_minutes} minutes · ${dashboard.today.meal.category || 'Dinner'}`
                  : 'Open the meal plan to choose dinner.'}</p>
              </article>
              <article className="feature-card">
                <span>Tomorrow</span>
                <h2>{dashboard?.tomorrow?.title || 'Nothing planned yet'}</h2>
                <p>{dashboard?.unplanned_days ?? 7} of the next {days} days still need a dinner.</p>
              </article>
            </section>
            <section className="section-heading">
              <div><span className="eyebrow">Household overview</span><h2>Upcoming dinners</h2></div>
              <button className="secondary" onClick={() => setView('plan')}>Edit plan</button>
            </section>
            <div className="upcoming-list">
              {Array.from({ length: days }, (_, offset) => {
                const dateValue = isoDate(offset);
                const entry = planByDate.get(dateValue);
                return (
                  <article className="day-row" key={dateValue}>
                    <time>{formatDate(dateValue)}</time>
                    <strong>{entry?.title || 'Choose a meal'}</strong>
                    <span>{entry?.meal ? `${entry.meal.prep_minutes}m prep` : entry?.entry_type || 'Unplanned'}</span>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {view === 'meals' && (
          <>
            <section className="section-heading">
              <div><span className="eyebrow">Recipe library</span><h2>Meal database</h2></div>
            </section>
            <input className="search" value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Search meals, categories or ingredients" />
            <div className="meal-grid">
              {filteredMeals.map((meal) => (
                <article className="meal-card" key={meal.id}>
                  {meal.image_url
                    ? <img className="meal-image" src={meal.image_url} alt="" />
                    : <div className="meal-placeholder">{meal.name.slice(0, 1).toUpperCase()}</div>}
                  <div className="meal-card-body">
                    <span>{meal.category || 'Dinner'}</span>
                    <h3>{meal.favourite ? '★ ' : ''}{meal.name}</h3>
                    <p>{meal.description || 'No description added yet.'}</p>
                    <div className="meal-meta">
                      <span>{meal.prep_minutes}m prep</span>
                      <span>{meal.cook_minutes}m cook</span>
                      <span>{meal.servings} serves</span>
                    </div>
                    <div className="meal-card-actions">
                      <button type="button" className="secondary" onClick={() => {
                        setSelectedMeal(meal);
                        setDetailServings(meal.servings);
                      }}>View recipe</button>
                      <button type="button" className="primary" onClick={() => setPlanningMeal(meal)}>Add to plan</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {view === 'plan' && (
          <>
            <section className="section-heading">
              <div><span className="eyebrow">Fast planning</span><h2>Upcoming meal plan</h2></div>
              <div className="heading-actions">
                <div className="segmented">
                  <button className={days === 7 ? 'active' : ''} onClick={() => setDays(7)}>7 days</button>
                  <button className={days === 14 ? 'active' : ''} onClick={() => setDays(14)}>14 days</button>
                </div>
                <button className="secondary" type="button" onClick={exportShoppingList}>Export shopping list</button>
              </div>
            </section>
            <div className="planner">
              {Array.from({ length: days }, (_, offset) => {
                const dateValue = isoDate(offset);
                const entry = planByDate.get(dateValue);
                return (
                  <article className={offset === 0 ? 'plan-row today' : 'plan-row'} key={dateValue}>
                    <div><span>{offset === 0 ? 'Today' : formatDate(dateValue).split(',')[0]}</span>
                      <strong>{formatDate(dateValue)}</strong></div>
                    <select value={entry?.meal_id || (entry?.entry_type !== 'meal' ? entry?.entry_type : '') || ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (['takeaway', 'leftovers', 'eating_out', 'no_meal'].includes(value)) {
                          void assignMeal(dateValue, null, value);
                        } else {
                          void assignMeal(dateValue, value ? Number(value) : null);
                        }
                      }}>
                      <option value="">Choose a meal</option>
                      <optgroup label="Special nights">
                        <option value="takeaway">Takeaway</option>
                        <option value="leftovers">Leftovers</option>
                        <option value="eating_out">Eating out</option>
                        <option value="no_meal">No meal required</option>
                      </optgroup>
                      <optgroup label="Recipes">
                        {meals.map((meal) => <option value={meal.id} key={meal.id}>{meal.name}</option>)}
                      </optgroup>
                    </select>
                    <span className={entry ? 'status planned' : 'status'}>{entry ? 'Planned' : 'Open'}</span>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </main>

      {selectedMeal && (
        <div className="modal-backdrop" onMouseDown={() => setSelectedMeal(null)}>
          <section className="modal recipe-detail-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div><span className="eyebrow">Recipe</span><h2>{selectedMeal.name}</h2></div>
              <button type="button" className="icon-button" onClick={() => setSelectedMeal(null)}>×</button>
            </div>
            {selectedMeal.image_url && <img className="detail-image" src={selectedMeal.image_url} alt="" />}
            <div className="detail-summary">
              <span>{selectedMeal.prep_minutes}m prep</span>
              <span>{selectedMeal.cook_minutes}m cook</span>
              <span>{selectedMeal.difficulty}</span>
            </div>
            {selectedMeal.description && <p className="detail-description">{selectedMeal.description}</p>}
            <div className="serving-control">
              <label>Scale recipe</label>
              <div>
                <button type="button" onClick={() => setDetailServings(Math.max(1, detailServings - 1))}>−</button>
                <strong>{detailServings} serves</strong>
                <button type="button" onClick={() => setDetailServings(detailServings + 1)}>+</button>
              </div>
            </div>
            <section className="recipe-section">
              <h3>Ingredients</h3>
              <ul className="ingredient-list">
                {selectedMeal.ingredients.map((ingredient) => {
                  const scaled = ingredient.quantity === null ? null : ingredient.quantity * (detailServings / selectedMeal.servings);
                  return <li key={`${ingredient.id}-${ingredient.name}`}>
                    <span>{ingredient.name}</span>
                    <strong>{scaled === null ? '' : Number(scaled.toFixed(2))} {ingredient.unit || ''}</strong>
                  </li>;
                })}
              </ul>
            </section>
            <section className="recipe-section">
              <h3>Method</h3>
              {selectedMeal.instructions.length ? (
                <ol className="instruction-list">
                  {selectedMeal.instructions.map((instruction, index) => <li key={`${index}-${instruction}`}>{instruction}</li>)}
                </ol>
              ) : <p className="muted">No cooking instructions have been added yet.</p>}
            </section>
            {selectedMeal.notes && <section className="recipe-section"><h3>Notes</h3><p>{selectedMeal.notes}</p></section>}
            <div className="modal-actions split-actions">
              <div>
                <button type="button" className="secondary" onClick={() => void toggleFavourite(selectedMeal)}>
                  {selectedMeal.favourite ? 'Remove favourite' : 'Add favourite'}
                </button>
                <button type="button" className="danger" onClick={() => void archiveMeal(selectedMeal)}>Archive</button>
              </div>
              <button type="button" className="primary" onClick={() => openEditForm(selectedMeal)}>Edit recipe</button>
            </div>
          </section>
        </div>
      )}

      {planningMeal && (
        <div className="modal-backdrop" onMouseDown={() => setPlanningMeal(null)}>
          <section className="modal plan-picker-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div><span className="eyebrow">Add recipe to plan</span><h2>{planningMeal.name}</h2></div>
              <button type="button" className="icon-button" onClick={() => setPlanningMeal(null)}>×</button>
            </div>
            <div className="plan-picker-toolbar">
              <span>Upcoming days</span>
              <div className="segmented">
                <button type="button" className={planningDays === 7 ? 'active' : ''} onClick={() => setPlanningDays(7)}>7 days</button>
                <button type="button" className={planningDays === 14 ? 'active' : ''} onClick={() => setPlanningDays(14)}>14 days</button>
              </div>
            </div>
            <div className="plan-picker-list">
              {Array.from({ length: planningDays }, (_, offset) => {
                const dateValue = isoDate(offset);
                const entry = planByDate.get(dateValue);
                const selected = entry?.meal_id === planningMeal.id;
                return (
                  <article className={offset === 0 ? 'plan-picker-row today' : 'plan-picker-row'} key={dateValue}>
                    <div><span>{offset === 0 ? 'Today' : formatDate(dateValue).split(',')[0]}</span><strong>{formatDate(dateValue)}</strong></div>
                    <div><span>Current meal</span><strong>{entry?.title || 'Nothing planned'}</strong></div>
                    <button type="button" className={selected ? 'secondary selected' : entry ? 'secondary' : 'primary'}
                      disabled={selected || savingDate === dateValue}
                      onClick={() => void assignMeal(dateValue, planningMeal.id)}>
                      {savingDate === dateValue ? 'Saving...' : selected ? 'Selected' : entry ? 'Change' : 'Add'}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {showMealForm && (
        <div className="modal-backdrop" onMouseDown={resetMealForm}>
          <form className="modal recipe-form-modal" onSubmit={saveMeal} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div><span className="eyebrow">Recipe library</span><h2>{editingMeal ? 'Edit meal' : 'Add a meal'}</h2></div>
              <button type="button" className="icon-button" onClick={resetMealForm}>×</button>
            </div>
            <label>Meal name<input name="name" required maxLength={180} defaultValue={editingMeal?.name || ''} /></label>
            <label>Description<textarea name="description" rows={3} defaultValue={editingMeal?.description || ''} /></label>

            <label>Categories</label>
            <div className="token-field">
              <div className="token-list">
                {selectedCategories.map((item) => (
                  <button type="button" className="token" key={item}
                    onClick={() => setSelectedCategories((current) => current.filter((entry) => entry !== item))}>
                    {item}<span>×</span>
                  </button>
                ))}
                <input value={categoryInput} onChange={(event) => setCategoryInput(event.target.value)}
                  onKeyDown={handleCategoryKey}
                  placeholder={selectedCategories.length ? 'Add another category' : 'Type or select categories'} />
              </div>
              {(categorySuggestions.length > 0 || categoryInput.trim()) && (
                <div className="suggestions">
                  {categorySuggestions.map((item) => (
                    <button type="button" key={item} onClick={() => addCategory(item)}>{item}</button>
                  ))}
                  {categoryInput.trim() && !categoryOptions.some((item) => item.toLowerCase() === categoryInput.trim().toLowerCase()) && (
                    <button type="button" className="add-new" onClick={() => addCategory(categoryInput)}>
                      Add “{normalize(categoryInput)}” as a new category
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="form-grid three">
              <label>Prep minutes<input name="prep" type="number" min="0" defaultValue={editingMeal?.prep_minutes ?? 15} /></label>
              <label>Cook minutes<input name="cook" type="number" min="0" defaultValue={editingMeal?.cook_minutes ?? 30} /></label>
              <label>Servings<input name="servings" type="number" min="1" defaultValue={editingMeal?.servings ?? 4} /></label>
            </div>
            <div className="form-grid">
              <label>Cuisine<input name="cuisine" defaultValue={editingMeal?.cuisine || ''} placeholder="Italian" /></label>
              <label>Difficulty<select name="difficulty" defaultValue={editingMeal?.difficulty || 'easy'}>
                <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
              </select></label>
            </div>

            <div className="ingredient-editor-heading">
              <div><label>Ingredients</label><small>Add quantity and unit so the shopping list can total items correctly.</small></div>
              <button type="button" className="secondary" onClick={() => setIngredientRows((current) => [...current, emptyIngredient()])}>Add ingredient</button>
            </div>
            <datalist id="ingredient-options">
              {ingredientOptions.map((item) => <option value={item} key={item} />)}
            </datalist>
            <div className="ingredient-editor">
              {ingredientRows.map((row) => (
                <div className="ingredient-row" key={row.key}>
                  <input list="ingredient-options" value={row.name} onChange={(event) => updateIngredientRow(row.key, 'name', event.target.value)} placeholder="Ingredient" />
                  <input type="number" min="0" step="any" value={row.quantity} onChange={(event) => updateIngredientRow(row.key, 'quantity', event.target.value)} placeholder="Qty" />
                  <input value={row.unit} onChange={(event) => updateIngredientRow(row.key, 'unit', event.target.value)} placeholder="Unit" />
                  <button type="button" className="icon-button small" aria-label="Remove ingredient" onClick={() => setIngredientRows((current) => current.filter((item) => item.key !== row.key))}>×</button>
                </div>
              ))}
            </div>

            <label>Method<textarea name="instructions" rows={7} defaultValue={(editingMeal?.instructions || []).join('\n')} placeholder={'Enter one instruction per line\nFor example: Heat oil in a pan'} /></label>
            <label>Notes<textarea name="notes" rows={3} defaultValue={editingMeal?.notes || ''} /></label>
            <label>Source URL<input name="source_url" type="url" defaultValue={editingMeal?.source_url || ''} placeholder="https://..." /></label>

            <label className="image-upload">
              Meal image
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImage} />
              <span>{processingImage ? 'Processing image...' : 'Choose a JPG, PNG or WebP image'}</span>
            </label>
            {imageData && (
              <div className="image-preview">
                <img src={imageData} alt="Meal preview" />
                <button type="button" className="secondary" onClick={() => setImageData(null)}>Remove image</button>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="secondary" onClick={resetMealForm}>Cancel</button>
              <button className="primary" type="submit" disabled={processingImage}>{editingMeal ? 'Save changes' : 'Save recipe'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
