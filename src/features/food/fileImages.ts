export const IMAGE_WARNING_BYTES = 1024 * 1024
export const IMAGE_LIMIT_BYTES = 3 * 1024 * 1024
export const VIDEO_LIMIT_BYTES = 40 * 1024 * 1024

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const validateImageFile = (file: File): string | null => {
  if (!file.type.startsWith('image/')) return 'Choose an image file.'
  if (file.size > IMAGE_LIMIT_BYTES) return `Images must be ${formatFileSize(IMAGE_LIMIT_BYTES)} or smaller.`
  return null
}

export const validateVideoFile = (file: File): string | null => {
  if (!file.type.startsWith('video/')) return 'Choose a video file.'
  if (file.size > VIDEO_LIMIT_BYTES) return `Videos must be ${formatFileSize(VIDEO_LIMIT_BYTES)} or smaller.`
  return null
}

export const readFileAsDataUrl = (file: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'))
  reader.onload = () => resolve(String(reader.result))
  reader.readAsDataURL(file)
})

export const resolveFoodImage = (path: string | undefined): string | undefined => {
  if (!path) return undefined
  if (/^(?:data:|blob:|https?:\/\/)/i.test(path)) return path
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}
