/** Vidéos côté navigateur : dimensions + image d'affiche, sans aucun outil externe. */

/** Image courante d'une vidéo, en JPEG (affiche). */
export async function captureFrame(video: HTMLVideoElement, maxWidth = 1920): Promise<Blob | null> {
  if (!video.videoWidth) return null;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.86));
}

/** Lit les dimensions d'un fichier vidéo et en extrait une affiche (à 10 % de la durée, 1 s au plus). */
export async function probeVideo(
  file: File,
): Promise<{ width: number; height: number; poster: Blob | null }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.playsInline = true;
  video.src = url;
  const wait = (event: string, ms = 8000) =>
    new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), ms);
      video.addEventListener(event, () => (clearTimeout(timer), resolve(true)), { once: true });
    });
  try {
    if (!(await wait('loadeddata'))) return { width: 0, height: 0, poster: null };
    const result = {
      width: video.videoWidth,
      height: video.videoHeight,
      poster: null as Blob | null,
    };
    video.currentTime = Math.min(1, (video.duration || 1) * 0.1);
    if (await wait('seeked', 5000)) result.poster = await captureFrame(video);
    return result;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }
}
