import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { Gallery } from './Gallery'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).has('gallery') ? <Gallery /> : <App />)
