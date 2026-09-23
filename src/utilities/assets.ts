export const assetUrl = (path: string): string =>
  /^(?:data:|blob:|https?:\/\/)/i.test(path) ? path : `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
