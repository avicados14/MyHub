import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource-variable/manrope'
import '@fontsource-variable/newsreader'
import './styles/global.css'
import App from './app/App'
import { AppProvider } from './app/AppContext'
import { GitHubSyncProvider } from './sync/GitHubSyncContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AppProvider>
        <GitHubSyncProvider>
          <App />
        </GitHubSyncProvider>
      </AppProvider>
    </HashRouter>
  </StrictMode>,
)
