import { createRoot } from 'react-dom/client';
import styleText from '../index.css?inline'; // We'll inject tailwind inside the shadow dom

import { ContentApp } from './ContentApp';
import { FloatingTrigger } from '../components/FloatingTrigger';

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

  // Add the Floating Trigger
  const triggerContainer = document.createElement('div');
  triggerContainer.id = 'serp-sum-trigger-root';
  document.body.appendChild(triggerContainer);

  const triggerShadow = triggerContainer.attachShadow({ mode: 'open' });
  const triggerRootEl = document.createElement('div');
  triggerShadow.appendChild(triggerRootEl);

  const triggerRoot = createRoot(triggerRootEl);
  triggerRoot.render(
    <FloatingTrigger onClick={() => chrome.runtime.sendMessage({ action: "OPEN_SIDEBAR" })} />
  );
}

init();
