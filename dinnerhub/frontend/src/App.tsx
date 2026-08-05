import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

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

  const filteredMeals = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return meals;
    return meals.filter((meal) => [
      meal.name,
      meal.main_protein,
      meal.category,
      ...meal.ingredients.map((item) => item.name)
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [meals, search]);

  const planByDate = useMemo(() => new Map(plan.map((entry) => [entry.meal_date, entry])), [plan]);

  const saveMeal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ingredientNames = String(form.get('ingredients') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    try {
      await api<Meal>('meals', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          description: form.get('description') || null,
          main_protein: form.get('protein') || null,
          category: form.get('category') || null,
          prep_minutes: Number(form.get('prep') || 0),
          cook_minutes: Number(form.get('cook') || 0),
          servings: Number(form.get('servings') || 4),
          difficulty: 'easy',
          ingredients: ingredientNames.map((name) => ({
            name,
            quantity: null,
            unit: null,
            shopping_category: 'Other'
          })),
          instructions: []
        })
      });
      setShowMealForm(false);
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
                  ? `${dashboard.today.meal.total_minutes} minutes · ${dashboard.today.meal.main_protein || 'Flexible'}`
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
            <section className="stats-grid">
              <article><strong>{dashboard?.active_meals ?? 0}</strong><span>Active recipes</span></article>
              <article><strong>{days - (dashboard?.unplanned_days ?? days)}</strong><span>Days planned</span></article>
              <article><strong>{dashboard?.version || '0.1.1'}</strong><span>Installed version</span></article>
            </section>
          </>
        )}

        {view === 'meals' && (
          <>
            <section className="section-heading">
              <div><span className="eyebrow">Recipe library</span><h2>Meal database</h2></div>
            </section>
            <input
              className="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search meals, proteins or ingredients"
            />
            <div className="meal-grid">
              {filteredMeals.map((meal) => (
                <article className="meal-card" key={meal.id}>
                  <div className="meal-placeholder">{meal.name.slice(0, 1).toUpperCase()}</div>
                  <div className="meal-card-body">
                    <span>{meal.category || 'Dinner'} · {meal.main_protein || 'Flexible'}</span>
                    <h3>{meal.name}</h3>
                    <p>{meal.description || 'No description added yet.'}</p>
                    <div className="meal-meta">
                      <span>{meal.prep_minutes}m prep</span>
                      <span>{meal.cook_minutes}m cook</span>
                      <span>{meal.servings} serves</span>
                    </div>
                    <button
                      type="button"
                      className="plan-meal-button"
                      onClick={() => setPlanningMeal(meal)}
                    >
                      Add to meal plan
                    </button>
                  </div>
                </article>
              ))}
              {!filteredMeals.length && (
                <div className="empty-state"><h3>No recipes found</h3><p>Add the first DinnerHub recipe or clear the search.</p></div>
              )}
            </div>
          </>
        )}

        {view === 'plan' && (
          <>
            <section className="section-heading">
              <div><span className="eyebrow">Fast planning</span><h2>Upcoming meal plan</h2></div>
              <div className="segmented">
                <button className={days === 7 ? 'active' : ''} onClick={() => setDays(7)}>7 days</button>
                <button className={days === 14 ? 'active' : ''} onClick={() => setDays(14)}>14 days</button>
              </div>
            </section>
            <div className="planner">
              {Array.from({ length: days }, (_, offset) => {
                const dateValue = isoDate(offset);
                const entry = planByDate.get(dateValue);
                return (
                  <article className={offset === 0 ? 'plan-row today' : 'plan-row'} key={dateValue}>
                    <div>
                      <span>{offset === 0 ? 'Today' : formatDate(dateValue).split(',')[0]}</span>
                      <strong>{formatDate(dateValue)}</strong>
                    </div>
                    <select
                      value={entry?.meal_id || (entry?.entry_type !== 'meal' ? entry?.entry_type : '') || ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (['takeaway', 'leftovers', 'eating_out', 'no_meal'].includes(value)) {
                          void assignMeal(dateValue, null, value);
                        } else {
                          void assignMeal(dateValue, value ? Number(value) : null);
                        }
                      }}
                    >
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
          <section
            className="modal plan-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-picker-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Add recipe to plan</span>
                <h2 id="plan-picker-title">{planningMeal.name}</h2>
                <p className="modal-intro">Choose an upcoming day. Existing meals can be replaced directly.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setPlanningMeal(null)}>×</button>
            </div>

            <div className="plan-picker-toolbar">
              <span>Upcoming days</span>
              <div className="segmented">
                <button
                  type="button"
                  className={planningDays === 7 ? 'active' : ''}
                  onClick={() => setPlanningDays(7)}
                >
                  7 days
                </button>
                <button
                  type="button"
                  className={planningDays === 14 ? 'active' : ''}
                  onClick={() => setPlanningDays(14)}
                >
                  14 days
                </button>
              </div>
            </div>

            <div className="plan-picker-list">
              {Array.from({ length: planningDays }, (_, offset) => {
                const dateValue = isoDate(offset);
                const entry = planByDate.get(dateValue);
                const alreadySelected = entry?.meal_id === planningMeal.id;
                const buttonLabel = alreadySelected ? 'Selected' : entry ? 'Change' : 'Add';
                return (
                  <article className={offset === 0 ? 'plan-picker-row today' : 'plan-picker-row'} key={dateValue}>
                    <div className="plan-picker-date">
                      <span>{offset === 0 ? 'Today' : formatDate(dateValue).split(',')[0]}</span>
                      <strong>{formatDate(dateValue)}</strong>
                    </div>
                    <div className="plan-picker-current">
                      <span>Current meal</span>
                      <strong>{entry?.title || 'Nothing planned'}</strong>
                    </div>
                    <button
                      type="button"
                      className={alreadySelected ? 'secondary selected' : entry ? 'secondary' : 'primary'}
                      disabled={alreadySelected || savingDate === dateValue}
                      onClick={() => void assignMeal(dateValue, planningMeal.id)}
                    >
                      {savingDate === dateValue ? 'Saving...' : buttonLabel}
                    </button>
                  </article>
                );
              })}
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setPlanningMeal(null)}>Close</button>
            </div>
          </section>
        </div>
      )}

      {showMealForm && (
        <div className="modal-backdrop" onMouseDown={() => setShowMealForm(false)}>
          <form className="modal" onSubmit={saveMeal} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div><span className="eyebrow">Recipe library</span><h2>Add a meal</h2></div>
              <button type="button" className="icon-button" onClick={() => setShowMealForm(false)}>×</button>
            </div>
            <label>Meal name<input name="name" required maxLength={180} /></label>
            <label>Description<textarea name="description" rows={3} /></label>
            <div className="form-grid">
              <label>Main protein<input name="protein" placeholder="Chicken" /></label>
              <label>Category<input name="category" placeholder="Curry" /></label>
            </div>
            <div className="form-grid three">
              <label>Prep minutes<input name="prep" type="number" min="0" defaultValue="15" /></label>
              <label>Cook minutes<input name="cook" type="number" min="0" defaultValue="30" /></label>
              <label>Servings<input name="servings" type="number" min="1" defaultValue="4" /></label>
            </div>
            <label>
              Ingredients
              <input name="ingredients" placeholder="Chicken, rice, coconut milk" />
              <small>Separate ingredients with commas. Quantities can be added in the detailed editor planned for v0.2.0.</small>
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setShowMealForm(false)}>Cancel</button>
              <button className="primary" type="submit">Save recipe</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
