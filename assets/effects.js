const EFFECT_SLUGS = new Set([
  'sepia-tone',
  'black-and-white',
  'vignette',
  'duotone',
  'glitch-art',
  'mirror-kaleidoscope',
  'tilt-shift',
  'lomo-lomography',
  'thermal-infrared',
  'neon-glow',
  'red-eye-fix',
  'auto-color-correct',
  'hdr-effect',
  'passport-photo',
  'id-photo',
  'social-media-resize'
])

function clamp(value) {
  return Math.max(0, Math.min(255, value))
}

function scaledCanvas(bitmap) {
  const limit = 1400
  const scale = Math.min(1, limit / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return { canvas, context }
}

function eachPixel(imageData, handler) {
  const data = imageData.data
  for (let index = 0; index < data.length; index += 4) {
    handler(data, index)
  }
}

function applySepia(imageData) {
  eachPixel(imageData, (data, index) => {
    const r = data[index]
    const g = data[index + 1]
    const b = data[index + 2]
    data[index] = clamp(r * 0.393 + g * 0.769 + b * 0.189)
    data[index + 1] = clamp(r * 0.349 + g * 0.686 + b * 0.168)
    data[index + 2] = clamp(r * 0.272 + g * 0.534 + b * 0.131)
  })
}

function applyBlackWhite(imageData) {
  eachPixel(imageData, (data, index) => {
    const gray = (data[index] + data[index + 1] + data[index + 2]) / 3
    data[index] = gray
    data[index + 1] = gray
    data[index + 2] = gray
  })
}

function applyVignette(imageData, width, height) {
  const centerX = width / 2
  const centerY = height / 2
  const maxDistance = Math.hypot(centerX, centerY)
  const data = imageData.data
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const distance = Math.hypot(x - centerX, y - centerY)
      const factor = 1 - Math.pow(distance / maxDistance, 1.7) * 0.55
      data[index] *= factor
      data[index + 1] *= factor
      data[index + 2] *= factor
    }
  }
}

function applyDuotone(imageData) {
  eachPixel(imageData, (data, index) => {
    const gray = (data[index] + data[index + 1] + data[index + 2]) / 3 / 255
    data[index] = clamp(40 + gray * 160)
    data[index + 1] = clamp(15 + gray * 110)
    data[index + 2] = clamp(120 + gray * 90)
  })
}

function applyGlitch(imageData, width, height) {
  const copy = new Uint8ClampedArray(imageData.data)
  for (let y = 0; y < height; y += 12) {
    const shift = Math.round(Math.sin(y / 9) * 8)
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const shiftedX = Math.max(0, Math.min(width - 1, x + shift))
      const sourceIndex = (y * width + shiftedX) * 4
      imageData.data[index] = copy[sourceIndex]
      imageData.data[index + 1] = copy[Math.max(0, sourceIndex - 4) + 1]
      imageData.data[index + 2] = copy[Math.min(copy.length - 2, sourceIndex + 4) + 2]
    }
  }
}

function applyThermal(imageData) {
  eachPixel(imageData, (data, index) => {
    const gray = (data[index] + data[index + 1] + data[index + 2]) / 3
    data[index] = clamp(gray * 1.3)
    data[index + 1] = clamp(255 - Math.abs(gray - 128) * 1.8)
    data[index + 2] = clamp(255 - gray * 1.1)
  })
}

function applyAutoColor(imageData, saturationBoost = 1.12, contrastBoost = 1.08) {
  eachPixel(imageData, (data, index) => {
    const r = data[index]
    const g = data[index + 1]
    const b = data[index + 2]
    const average = (r + g + b) / 3
    data[index] = clamp((r - average) * saturationBoost + average)
    data[index + 1] = clamp((g - average) * saturationBoost + average)
    data[index + 2] = clamp((b - average) * saturationBoost + average)
    data[index] = clamp((data[index] - 128) * contrastBoost + 128)
    data[index + 1] = clamp((data[index + 1] - 128) * contrastBoost + 128)
    data[index + 2] = clamp((data[index + 2] - 128) * contrastBoost + 128)
  })
}

function mirrorKaleidoscope(context, canvas) {
  const half = Math.floor(canvas.width / 2)
  const imageData = context.getImageData(0, 0, half, canvas.height)
  context.save()
  context.scale(-1, 1)
  context.putImageData(imageData, -canvas.width, 0)
  context.restore()
}

function applyPassport(canvas, context) {
  const size = 1024
  const finalCanvas = document.createElement('canvas')
  finalCanvas.width = size
  finalCanvas.height = size
  const finalContext = finalCanvas.getContext('2d')
  finalContext.fillStyle = '#ffffff'
  finalContext.fillRect(0, 0, size, size)
  const scale = Math.min(size / canvas.width, size / canvas.height)
  const width = canvas.width * scale
  const height = canvas.height * scale
  finalContext.drawImage(canvas, (size - width) / 2, (size - height) / 2, width, height)
  return finalCanvas
}

async function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Unable to create result image.'))
    }, 'image/png')
  })
}

export function supportsInstantEffect(filter) {
  return EFFECT_SLUGS.has(filter.slug) || filter.clientSideOnly
}

export async function applyInstantEffect(filter, file) {
  const bitmap = await createImageBitmap(file)
  const { canvas, context } = scaledCanvas(bitmap)
  let imageData = context.getImageData(0, 0, canvas.width, canvas.height)

  switch (filter.slug) {
    case 'sepia-tone':
      applySepia(imageData)
      break
    case 'black-and-white':
      applyBlackWhite(imageData)
      break
    case 'vignette':
      applyVignette(imageData, canvas.width, canvas.height)
      break
    case 'duotone':
      applyDuotone(imageData)
      break
    case 'glitch-art':
      applyGlitch(imageData, canvas.width, canvas.height)
      break
    case 'mirror-kaleidoscope':
      mirrorKaleidoscope(context, canvas)
      return canvasToBlob(canvas)
    case 'tilt-shift':
      context.filter = 'blur(6px)'
      context.drawImage(canvas, 0, 0)
      context.filter = 'none'
      context.drawImage(bitmap, 0, canvas.height * 0.26, canvas.width, canvas.height * 0.48, 0, canvas.height * 0.26, canvas.width, canvas.height * 0.48)
      return canvasToBlob(canvas)
    case 'lomo-lomography':
      applyAutoColor(imageData, 1.25, 1.14)
      applyVignette(imageData, canvas.width, canvas.height)
      break
    case 'thermal-infrared':
      applyThermal(imageData)
      break
    case 'neon-glow':
      applyAutoColor(imageData, 1.4, 1.2)
      applyGlitch(imageData, canvas.width, canvas.height)
      break
    case 'red-eye-fix':
      applyAutoColor(imageData, 1.02, 1.06)
      break
    case 'auto-color-correct':
      applyAutoColor(imageData)
      break
    case 'hdr-effect':
      applyAutoColor(imageData, 1.15, 1.18)
      break
    case 'passport-photo':
    case 'id-photo':
    case 'social-media-resize':
      return canvasToBlob(applyPassport(canvas, context))
    default:
      applyAutoColor(imageData)
      break
  }

  context.putImageData(imageData, 0, 0)
  return canvasToBlob(canvas)
}
