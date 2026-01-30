// Type declarations for modules without TypeScript definitions

declare module 'oui-data' {
  const data: Record<string, string>
  export default data
}

declare module 'oui' {
  function lookup(mac: string): string | null
  export { lookup }
}
