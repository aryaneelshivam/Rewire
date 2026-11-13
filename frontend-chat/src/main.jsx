// First, so the page's look is settled before anything draws.
import './perf';
import React from 'react';
import { createRoot } from 'react-dom/client';
import Root from './AuthGate.jsx';
// Arc's foundation and Rewire's tokens, for the dashboard's player and timeline; then the chat's own styles.
import '@/components/arc/foundation.css';
import '@/rewire-tokens.css';
import './styles.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><Root /></React.StrictMode>);
