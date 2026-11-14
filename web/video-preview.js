// Decode covers outside the transformed workflow canvas. The canvas contains
// ordinary images; native video playback lives in the output panel.
const covers = new Map();
export const videoCover = url => covers.get(url)?.image;

function cover(url) {
  if (covers.has(url)) return covers.get(url).pending;
  const entry = {};
  covers.set(url, entry);
  entry.pending = new Promise(resolve => {
    const video = document.createElement('video');
    video.preload = 'auto'; video.muted = true; video.playsInline = true;
    const finish = image => {
      clearTimeout(timeout);
      video.onloadeddata = video.onerror = null;
      video.removeAttribute('src'); video.load();
      entry.image = image;
      if (!image) covers.delete(url);
      resolve(image);
    };
    video.onloadeddata = () => {
      try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 400 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL('image/jpeg', .85));
      } catch { finish(undefined); }
    };
    video.onerror = () => finish(undefined);
    const timeout = setTimeout(() => finish(undefined), 15_000);
    video.src = url;
  });
  return entry.pending;
}

export function loadVideoCovers(root) {
  for (const image of root.querySelectorAll('img[data-video-cover]')) {
    const url = image.dataset.videoCover;
    if (image.hasAttribute('src')) continue;
    void cover(url).then(source => {
      if (source && image.isConnected && image.dataset.videoCover === url) image.src = source;
    });
  }
}
