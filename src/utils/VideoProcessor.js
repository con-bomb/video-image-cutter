/**
 * VideoProcessor Utility
 * Extracts frames from a video file using HTML5 Video and Canvas APIs.
 */

export const extractFrames = (file, fps = 1, onProgress, abortSignal = null) => {
  return new Promise((resolve, reject) => {
    if (abortSignal && abortSignal.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'));
    }

    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.src = url;
    video.muted = true;
    video.crossOrigin = 'anonymous'; // Generally safe for local files
    
    let seekTimeout = null;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      if (seekTimeout) clearTimeout(seekTimeout);
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
    };

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }
    
    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!duration || !isFinite(duration)) {
        cleanup();
        reject(new Error('Invalid video duration.'));
        return;
      }

      const totalFrames = Math.floor(duration * fps) || 1;
      const frames = [];
      let currentFrame = 0;
      let isCapturingLastFrame = false;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      // Set canvas size to match video resolution
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const captureFrame = () => {
        if (seekTimeout) clearTimeout(seekTimeout);
        if (abortSignal && abortSignal.aborted) return; // handled by abort listener

        try {
          // Draw current video frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Export as JPEG (lighter than PNG for photos/frames)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          const timestamp = video.currentTime;
          const formattedTime = new Date(timestamp * 1000).toISOString().substr(14, 5);

          frames.push({
            id: `frame_${file.name}_${isCapturingLastFrame ? 'final' : currentFrame}`,
            fileName: file.name,
            dataUrl,
            timestamp,
            formattedTime
          });

          if (isCapturingLastFrame) {
            onProgress(100);
            cleanup();
            resolve(frames);
            return;
          }

          currentFrame++;
          // Use totalFrames + 1 for progress to account for the final frame
          onProgress(Math.round((currentFrame / (totalFrames + 1)) * 100));

          if (currentFrame < totalFrames) {
            // Seek to next frame time
            video.currentTime = currentFrame / fps;
          } else {
            // Time to capture the final frame
            isCapturingLastFrame = true;
            // Seek to just slightly before the very end to avoid black frames on some browsers
            video.currentTime = Math.max(0, duration - 0.05);
          }

          // Set timeout for the next seek
          seekTimeout = setTimeout(() => {
            cleanup();
            reject(new Error(`Video processing timed out while seeking (Frame ${currentFrame}).`));
          }, 10000); // 10 second timeout

        } catch (e) {
          cleanup();
          reject(e);
        }
      };

      // When the video finishes seeking, capture the frame
      video.onseeked = () => {
        captureFrame();
      };

      // Start the process
      video.currentTime = 0;
      seekTimeout = setTimeout(() => {
        cleanup();
        reject(new Error('Video processing timed out while seeking.'));
      }, 10000);
    };

    video.onerror = (e) => {
      cleanup();
      reject(new Error('Error loading video file: ' + (video.error ? video.error.message : 'Unknown error')));
    };
  });
};
