export interface OcrProgress {
  status: string
  progress: number
}

export interface OcrResult {
  text: string
  confidence: number
}

export const recognizeImageText = async (
  image: Blob | string,
  onProgress?: (progress: OcrProgress) => void,
): Promise<OcrResult> => {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', undefined, {
    logger: (message) => {
      if (typeof message.progress === 'number') onProgress?.({ status: message.status, progress: message.progress })
    },
  })
  try {
    const result = await worker.recognize(image)
    return { text: result.data.text.trim(), confidence: result.data.confidence }
  } finally {
    await worker.terminate()
  }
}

const waitForEvent = (target: HTMLMediaElement, event: 'loadedmetadata' | 'seeked'): Promise<void> =>
  new Promise((resolve, reject) => {
    const handle = () => {
      cleanup()
      resolve()
    }
    const fail = () => {
      cleanup()
      reject(new Error('The selected video frame could not be read.'))
    }
    const cleanup = () => {
      target.removeEventListener(event, handle)
      target.removeEventListener('error', fail)
    }
    target.addEventListener(event, handle, { once: true })
    target.addEventListener('error', fail, { once: true })
  })

export const extractVideoFrame = async (file: File, requestedTime = 0): Promise<Blob> => {
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'metadata'
  const source = URL.createObjectURL(file)
  try {
    const loaded = waitForEvent(video, 'loadedmetadata')
    video.src = source
    await loaded
    const duration = Number.isFinite(video.duration) ? video.duration : 0
    const selectedTime = Math.max(0, Math.min(requestedTime, Math.max(0, duration - 0.05)))
    if (selectedTime > 0) {
      const seeked = waitForEvent(video, 'seeked')
      video.currentTime = selectedTime
      await seeked
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context || !canvas.width || !canvas.height) throw new Error('The selected video frame is empty.')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('The selected video frame could not be created.'))),
        'image/jpeg',
        0.9,
      )
    })
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(source)
  }
}
