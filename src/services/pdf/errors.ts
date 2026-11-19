export class ImportError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ImportError'
    this.code = code
  }
}
