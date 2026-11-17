import { supabase } from './supabase'

const BUCKET = 'item-photos'
const MAX_BYTES = 100_000

/** Resizes a photo in the browser to a WebP of 100 KB or less. */
export async function shrinkToWebp(file: Blob, maxBytes = MAX_BYTES): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    let side = 900
    for (let round = 0; round < 6; round++) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.82, 0.7, 0.58, 0.46]) {
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', quality))
        if (!blob) throw new Error('This browser can’t prepare photos. Paste an image link instead.')
        if (blob.size <= maxBytes) return blob
      }
      side = Math.round(side * 0.75)
    }
  } finally {
    bitmap.close()
  }
  throw new Error('That photo is too detailed to shrink. Try another, or paste an image link.')
}

/** Uploads a photo to the user's folder and returns its public address. */
export async function uploadPhoto(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  const blob = await shrinkToWebp(file)
  const path = `${userId}/${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' })
  if (error) {
    if (/row-level security|unauthorized|403/i.test(error.message)) {
      throw new Error('You can keep up to 10 uploaded photos. Remove one from another wish, or paste an image link instead.')
    }
    throw error
  }
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Deletes an uploaded photo. Links to store images are left alone. Never throws. */
export async function removePhoto(url: string): Promise<void> {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const at = url.indexOf(marker)
  if (at === -1) return
  await supabase.storage.from(BUCKET).remove([decodeURIComponent(url.slice(at + marker.length))]).catch(() => undefined)
}

export const isUploadedPhoto = (url: string | null) => !!url && url.includes(`/storage/v1/object/public/${BUCKET}/`)
