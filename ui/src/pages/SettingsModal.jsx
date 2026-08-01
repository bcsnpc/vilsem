import React from 'react'
import Health from './Health.jsx'
import { Modal } from '../ui/Modal.jsx'
import '../vilsem/tokens.css'

/**
 * SettingsModal — renders the existing Health page inside the design-system
 * Modal. Health has comprehensive AI key management (test, save, remove, model
 * selection) + connection status + cache stats; we just wrap it. (Health's own
 * styling is out of the chrome-redesign scope.)
 */
export default function SettingsModal({ onClose }) {
  return (
    <Modal title="Settings" onClose={onClose} width={860}>
      {/* Negate the Modal body padding so Slate Health fills edge-to-edge. */}
      <div className="vilsem-root" style={{ margin: 'calc(-1 * var(--space-5))', background: 'var(--v-bg-1)' }}>
        <Health />
      </div>
    </Modal>
  )
}
