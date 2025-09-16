import React from 'react'
import { createRoot } from 'react-dom/client'
import { useStore } from './state/store'
import ConnectCanvas from './pages/ConnectCanvas'
import Dashboard from './pages/Dashboard'

function Root() {
  const connected = useStore(s => s.connected)
  return <div>{connected ? <Dashboard/> : <ConnectCanvas/>}</div>
}

createRoot(document.getElementById('root')!).render(<Root />)