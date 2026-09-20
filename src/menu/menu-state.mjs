const PANELS = new Set(['drive', 'tests', 'competition', 'workshop', 'collection', 'settings']);

export function initialMenuState() { return { view: 'home', panel: 'drive' }; }

// Presentation only: profile, track selection and driving remain owned by V6.
export function reduceMenu(state, event) {
  switch (event.type) {
    case 'panel': return PANELS.has(event.panel) ? { view: 'section', panel: event.panel } : state;
    case 'back': return state.view === 'section' ? { ...state, view: 'home' } : state;
    case 'open': return { ...state, view: 'home' };
    case 'close': return { ...state, view: 'closed' };
    default: return state;
  }
}
