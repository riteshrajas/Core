import { useEffect, useState } from 'react'
import {
  type APEXAILimits,
  currentLimits,
  statusListeners,
} from './APEXAiLimits.js'

export function useAPEXAiLimits(): APEXAILimits {
  const [limits, setLimits] = useState<APEXAILimits>({ ...currentLimits })

  useEffect(() => {
    const listener = (newLimits: APEXAILimits) => {
      setLimits({ ...newLimits })
    }
    statusListeners.add(listener)

    return () => {
      statusListeners.delete(listener)
    }
  }, [])

  return limits
}
