/** A short random id with a prefix: slot_x1y2z3a. */
export const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`
