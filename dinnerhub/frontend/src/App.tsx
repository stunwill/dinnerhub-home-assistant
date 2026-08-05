import { ChangeEvent, FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Ingredient = {
  id?: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  shopping_category: string;
};

type Meal = {
  id: number;
  name: string;
  description: string | null;
  main_protein: string | null;
  category: string | null;
  prep_minutes: number;
  cook_minutes: number;
  total_minutes: number;
  servings: number;
  ingredients: Ingredient[];
  active: boolean;
  favourite: boolean;
  image_url: string | null;
};

type PlanEntry = {
  id: number;
  meal_date: string;
  meal_id: number | null;
  title: string;
  entry_type: string;
  status: string;
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
  const [planningMeal, setPlanningMeal] = useState<Meal | null>(null);
  const [planningDays, setPlanningDays] = useState(14);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [ingredientInput, setIngredientInput] = useState('');
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'DinnerHub could not load');
    }
  }, [days, planningDays]);

  useEffect(() => { void load(); }, [load]);

  const ingredientOptions = useMemo(() => Array.from(new Set(
    meals.flatMap((meal) => meal.ingredients.map((item) => item.name))
  )).sort((a, b) => a.localeCompare(b)), [meals]);

  const categoryOptions = useMemo(() => Array.from(new Set(
    meals.flatMap((meal) => splitCategories(meal.category))
  )).sort((a, b) => a.localeCompare(b)), [meals]);

  const ingredientSuggestions = useMemo(() => {
    const term = ingredientInput.toLowerCase().trim();
    return ingredientOptions
      .filter((item) => !selectedIngredients.some((selected) => selected.toLowerCase() === item.toLowerCase()))
      .filter((item) => !term || item.toLowerCase().includes(term))
      .slice(0, 8);
  }, [ingredientInput, ingredientOptions, selectedIngredients]);

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

  const addIngredient = (raw: string) => {
    const value = normalize(raw);
    if (!value) return;
    if (!selectedIngredients.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setSelectedIngredients((current) => [...current, value]);
    }
    setIngredientInput('');
  };

  const addCategory = (raw: string) => {
    const value = normalize(raw);
    if (!value) return;
    if (!selectedCategories.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setSelectedCategories((current) => [...current, value]);
    }
    setCategoryInput('');
  };

  const handleTokenKey = (
    event: KeyboardEvent<HTMLInputElement>,
    value: string,
    add: (entry: string) => void
  ) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(value);
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

  const resetMealForm = () => {
    setShowMealForm(false);
    setSelectedCategories([]);
    setSelectedIngredients([]);
    setCategoryInput('');
    setIngredientInput('');
    setImageData(null);
  };

  const saveMeal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedIngredients.length) {
      setError('Add at least one ingredient');
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      await api<Meal>('meals', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          description: form.get('description') || null,
          main_protein: null,
          category: selectedCategories.join(', ') || null,
          prep_minutes: Number(form.get('prep') || 0),
          cook_minutes: Number(form.get('cook') || 0),
          servings: Number(form.get('servings') || 4),
          difficulty: 'easy',
          image_url: imageData,
          ingredients: selectedIngredients.map((name) => ({
            name,
            quantity: null,
            unit: null,
            shopping_category: 'Other'
          })),
          instructions: []
        })
      });
      resetMealForm();
      setMessage('Recipe added');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Recipe could not be saved');
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
          current.quantity += ingredient.quantity;
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
        <button className="primary" onClick={() => setShowMealForm(true)}>Add recipe</button>
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
                    <h3>{meal.name}</h3>
                    <p>{meal.description || 'No description added yet.'}</p>
                    <div className="meal-meta">
                      <span>{meal.prep_minutes}m prep</span>
                      <span>{meal.cook_minutes}m cook</span>
                      <span>{meal.servings} serves</span>
                    </div>
                    <button type="button" className="plan-meal-button" onClick={() => setPlanningMeal(meal)}>
                      Add to meal plan
                    </button>
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
          <form className="modal" onSubmit={saveMeal} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div><span className="eyebrow">Recipe library</span><h2>Add a meal</h2></div>
              <button type="button" className="icon-button" onClick={resetMealForm}>×</button>
            </div>
            <label>Meal name<input name="name" required maxLength={180} /></label>
            <label>Description<textarea name="description" rows={3} /></label>

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
                  onKeyDown={(event) => handleTokenKey(event, categoryInput, addCategory)}
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
              <label>Prep minutes<input name="prep" type="number" min="0" defaultValue="15" /></label>
              <label>Cook minutes<input name="cook" type="number" min="0" defaultValue="30" /></label>
              <label>Servings<input name="servings" type="number" min="1" defaultValue="4" /></label>
            </div>

            <label>Ingredients</label>
            <div className="token-field">
              <div className="token-list">
                {selectedIngredients.map((item) => (
                  <button type="button" className="token" key={item}
                    onClick={() => setSelectedIngredients((current) => current.filter((entry) => entry !== item))}>
                    {item}<span>×</span>
                  </button>
                ))}
                <input value={ingredientInput} onChange={(event) => setIngredientInput(event.target.value)}
                  onKeyDown={(event) => handleTokenKey(event, ingredientInput, addIngredient)}
                  placeholder={selectedIngredients.length ? 'Add another ingredient' : 'Type an ingredient and press Enter'} />
              </div>
              {(ingredientSuggestions.length > 0 || ingredientInput.trim()) && (
                <div className="suggestions">
                  {ingredientSuggestions.map((item) => (
                    <button type="button" key={item} onClick={() => addIngredient(item)}>{item}</button>
                  ))}
                  {ingredientInput.trim() && !ingredientOptions.some((item) => item.toLowerCase() === ingredientInput.trim().toLowerCase()) && (
                    <button type="button" className="add-new" onClick={() => addIngredient(ingredientInput)}>
                      Add “{normalize(ingredientInput)}” as a new ingredient
                    </button>
                  )}
                </div>
              )}
            </div>
            <small className="field-help">Choose existing ingredients or type a new one and press Enter.</small>

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
              <button className="primary" type="submit" disabled={processingImage}>Save recipe</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
