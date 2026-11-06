/* ============================================
   main.jsx — RESONIX Entry Point
   ============================================
   Yeh file sabse pehle run hoti hai.
   React ko DOM se connect karti hai.
   
   Simple explanation:
   - React.StrictMode = development mein extra 
     warnings dikhata hai (production mein nahi)
   - createRoot = React 18+ ka naya rendering method
   - render() = App component ko #root div mein lagao
   ============================================ */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Global styles — design system (colors, fonts, reset)
import './styles/design-system.css'

// App component — puri application ka root
import App from './App.jsx'

// React ko batao: #root div mein App render karo
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)

