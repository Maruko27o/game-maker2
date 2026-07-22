import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import './styles/global.css';
import App from './App';
import Grass from './pages/Grass';
import Stable from './pages/Stable';
import Create from './pages/Create';
import Collection from './pages/Collection';
import Race from './pages/Race';
import Ranking from './pages/Ranking';
import Hall from './pages/Hall';

// HashRouter keeps deep links working on GitHub Pages (no server rewrites).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Grass />} />
          <Route path="stable" element={<Stable />} />
          <Route path="create" element={<Create />} />
          <Route path="collection" element={<Collection />} />
          <Route path="race" element={<Race />} />
          <Route path="ranking" element={<Ranking />} />
          <Route path="hall" element={<Hall />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
);
