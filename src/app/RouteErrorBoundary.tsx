import { Component, type ReactNode } from 'react'

// A failed lazy import (for example, an old tab after a deployment) must not
// leave the whole application blank. Reload retrieves the current entrypoint.
export class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="route-loading" role="alert">
          <h2>This view could not open</h2>
          <p>Reload MyHub to try again. Your saved local data will stay on this device.</p>
          <button className="button button--primary" type="button" onClick={() => window.location.reload()}>
            Reload MyHub
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
