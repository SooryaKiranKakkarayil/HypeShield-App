export type DropStats = {
  dropId: string
  remainingStock: number
  successCount: number
  duplicateCount: number
  soldOutCount: number
  throttledCount: number
  conflictCount: number
  conflictExhaustedCount: number
  unknownCancelCount: number
  totalAttempts: number
  blockedCount: number
}