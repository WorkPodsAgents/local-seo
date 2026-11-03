import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../theme/theme.css'
import { startDemoIfAsked } from '../../src/ui/demo-start'
import { Report } from './report'

const root = document.getElementById('root')
if (root === null) throw new Error('report root missing')
void startDemoIfAsked().then(() =>
  createRoot(root).render(
    <StrictMode>
      <Report />
    </StrictMode>,
  ),
)
