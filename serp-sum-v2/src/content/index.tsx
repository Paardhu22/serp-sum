
import { createRoot } from 'react-dom/client';
import styleText from '../index.css?inline'; // We'll inject tailwind inside the shadow dom

import { ContentApp } from './ContentApp';

function init() {
  const container = document.createElement('div');
  container.id = 'serp-sum-root';
  document.body.appendChild(container);

  const shadow = container.attachShadow({ mode: 'open' });
  
  // Inject Tailwind styles inside shadow dom
  const style = document.createElement('style');
  style.textContent = styleText;
  shadow.appendChild(style);

  const rootEl = document.createElement('div');
  shadow.appendChild(rootEl);

  const root = createRoot(rootEl);
  root.render(<ContentApp />);
}

init();
