const dashboardMealImages = {
  data: null,
  applying: false,
  observer: null
};

const loadDashboardMealData = async () => {
  const response = await fetch('api/dashboard?days=7');
  if (!response.ok) throw new Error('Dashboard meal images could not be loaded');
  dashboardMealImages.data = await response.json();
};

const setMealCardImage = (card, entry, cardType) => {
  if (!card) return;
  const imageUrl = entry?.meal?.image_url;
  card.classList.add('dashboard-meal-image-card', `dashboard-meal-image-card--${cardType}`);
  card.classList.toggle('has-recipe-image', Boolean(imageUrl));

  if (imageUrl) {
    const safeUrl = String(imageUrl).replaceAll('"', '\\"');
    card.style.setProperty('--dashboard-meal-image', `url("${safeUrl}")`);
  } else {
    card.style.removeProperty('--dashboard-meal-image');
  }
};

const applyDashboardMealImages = () => {
  if (dashboardMealImages.applying || !dashboardMealImages.data) return;

  const heroCards = document.querySelectorAll('.hero-grid .feature-card');
  if (heroCards.length < 2) return;

  dashboardMealImages.applying = true;
  try {
    setMealCardImage(heroCards[0], dashboardMealImages.data.today, 'today');
    setMealCardImage(heroCards[1], dashboardMealImages.data.tomorrow, 'tomorrow');
  } finally {
    dashboardMealImages.applying = false;
  }
};

const refreshDashboardMealImages = async () => {
  try {
    await loadDashboardMealData();
    applyDashboardMealImages();
  } catch (error) {
    console.error('DinnerHub dashboard meal images failed to load', error);
  }
};

const startDashboardMealImages = async () => {
  await refreshDashboardMealImages();

  const root = document.getElementById('root');
  if (!root) return;

  dashboardMealImages.observer = new MutationObserver(() => {
    window.requestAnimationFrame(applyDashboardMealImages);
  });
  dashboardMealImages.observer.observe(root, { childList: true, subtree: true });

  window.setInterval(() => {
    void refreshDashboardMealImages();
  }, 60000);
};

void startDashboardMealImages();
