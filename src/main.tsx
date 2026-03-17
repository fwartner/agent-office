import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { OfficeProvider } from './office-provider'
import { ErrorBoundary } from './error-boundary'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <OfficeProvider>
        <App />
      </OfficeProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
