import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Landing from './Landing';
import { applyCssVars } from '../theme';
import './landing.css';

applyCssVars('night'); // same color tokens as the app (src/theme.ts)

createRoot(document.getElementById('root')!).render(<StrictMode><Landing /></StrictMode>);
