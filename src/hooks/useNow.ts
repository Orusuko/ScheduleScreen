import { useEffect, useState } from 'react'

/** El reloj de la interfaz. Avanza al cambio de minuto y se detiene con la app en segundo plano. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer = 0
    const tick = () => setNow(new Date())
    const arm = () => {
      window.clearTimeout(timer)
      if (document.visibilityState !== 'visible') return
      const wait = 60_000 - (Date.now() % 60_000) + 250
      timer = window.setTimeout(() => {
        tick()
        arm()
      }, wait)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
      arm()
    }
    onVisible()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return now
}
