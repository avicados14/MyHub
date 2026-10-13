import { useEffect, useState } from 'react'

export function useCookingWakeLock(enabled: boolean) {
  const [status, setStatus] = useState('Screen wake lock is off.')
  useEffect(() => {
    if (!enabled) return
    let disposed = false
    let lock: WakeLockSentinel | undefined
    let pending = false
    const request = async () => {
      if (document.visibilityState !== 'visible' || pending || (lock && !lock.released)) return
      if (!('wakeLock' in navigator)) {
        setStatus('Keeping the screen awake is unavailable on this device.')
        return
      }
      pending = true
      try {
        const acquired = await navigator.wakeLock.request('screen')
        if (disposed) {
          await acquired.release()
          return
        }
        lock = acquired
        setStatus('Screen will stay awake while cooking mode is visible.')
        acquired.addEventListener('release', () => {
          if (!disposed) setStatus('Screen wake lock released. Your device may dim the screen.')
        })
      } catch {
        if (!disposed) setStatus('Could not keep the screen awake. Check your device settings.')
      } finally {
        pending = false
      }
    }
    const visible = () => {
      void request()
    }
    void request()
    document.addEventListener('visibilitychange', visible)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', visible)
      if (lock && !lock.released) void lock.release().catch(() => {})
    }
  }, [enabled])
  return enabled ? status : 'Screen wake lock is off.'
}
