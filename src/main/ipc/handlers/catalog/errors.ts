export function invalidInput(details: unknown) {
  return { error: { code: 'INVALID_INPUT' as const, message: 'Invalid input', details } };
}

export function notFound(message: string) {
  return { error: { code: 'NOT_FOUND' as const, message } };
}
