import React, { useState, useRef, useEffect } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { X, Download, Copy, Crop as CropIcon, CheckCircle2 } from 'lucide-react';
import './BatchCrop.css';

export default function BatchCrop({ frames, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [crops, setCrops] = useState({}); // { frameId: percentCrop } for display
  const [pixelCrops, setPixelCrops] = useState({}); // { frameId: pixelCrop } for export
  const [imgDims, setImgDims] = useState({}); // { frameId: { w, h } } displayed size at crop time
  const [imgRefs, setImgRefs] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewImages, setPreviewImages] = useState([]);
  const cropWorkspaceRef = useRef(null);
  const [maxImgH, setMaxImgH] = useState(300); // safe small default

  const currentFrame = frames[currentIndex];
  const currentCrop = crops[currentFrame.id];

  // Measure the actual available space for the image
  // Re-run when previewMode changes so we re-attach to the fresh DOM element
  useEffect(() => {
    if (previewMode) return; // crop-workspace not in DOM during preview
    const el = cropWorkspaceRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.clientHeight;
      if (h > 0) setMaxImgH(h); // guard against 0 from unmounting
    };
    // Use requestAnimationFrame to ensure layout has settled
    requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [previewMode]);

  const handleImageLoad = (e, frameId) => {
    setImgRefs(prev => ({ ...prev, [frameId]: e.currentTarget }));
  };

  const handleCropChange = (pixelCrop, percentCrop) => {
    // Store percent crop for display (survives resize)
    setCrops(prev => ({ ...prev, [currentFrame.id]: percentCrop }));
  };

  const handleCropComplete = (pixelCrop, percentCrop) => {
    if (pixelCrop && pixelCrop.width > 0 && pixelCrop.height > 0) {
      setPixelCrops(prev => ({ ...prev, [currentFrame.id]: pixelCrop }));
      // Query the actual displayed image from the DOM — reliable regardless of onLoad timing
      const imgEl = cropWorkspaceRef.current?.querySelector('.crop-image');
      if (imgEl) {
        setImgDims(prev => ({ ...prev, [currentFrame.id]: { w: imgEl.width, h: imgEl.height } }));
      }
    } else {
      setPixelCrops(prev => {
        const n = { ...prev };
        delete n[currentFrame.id];
        return n;
      });
    }
  };

  const copyCropToAll = () => {
    const currentPercentCrop = crops[currentFrame.id];
    const currentPixelCrop = pixelCrops[currentFrame.id];
    const currentDims = imgDims[currentFrame.id];
    
    if (!currentPercentCrop || !currentPixelCrop) {
      alert("Please draw a crop area on the current image first.");
      return;
    }

    const newCrops = { ...crops };
    const newPixelCrops = { ...pixelCrops };
    const newImgDims = { ...imgDims };

    frames.forEach(f => {
      newCrops[f.id] = { ...currentPercentCrop };
      newPixelCrops[f.id] = { ...currentPixelCrop };
      if (currentDims) {
        newImgDims[f.id] = { ...currentDims };
      }
    });

    setCrops(newCrops);
    setPixelCrops(newPixelCrops);
    setImgDims(newImgDims);
  };

  const getCleanFileName = (fileName) => {
    return fileName.replace(/\.[^/.]+$/, "");
  };

  // Use pixel crop + displayed dimensions to compute exact natural-image crop
  const getCroppedImg = async (imageElement, pixelCrop, displayedDims) => {
    const canvas = document.createElement('canvas');
    
    if (!pixelCrop || pixelCrop.width === 0 || pixelCrop.height === 0) {
      canvas.width = imageElement.naturalWidth;
      canvas.height = imageElement.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageElement, 0, 0);
    } else {
      // Scale from displayed pixel coords to natural image coords
      // Fallback to natural dims if displayed dims weren't captured
      const dw = displayedDims?.w || imageElement.naturalWidth;
      const dh = displayedDims?.h || imageElement.naturalHeight;
      const scaleX = imageElement.naturalWidth / dw;
      const scaleY = imageElement.naturalHeight / dh;

      const sx = Math.round(pixelCrop.x * scaleX);
      const sy = Math.round(pixelCrop.y * scaleY);
      const sw = Math.round(pixelCrop.width * scaleX);
      const sh = Math.round(pixelCrop.height * scaleY);

      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageElement, sx, sy, sw, sh, 0, 0, sw, sh);
    }

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
    });
  };

  const loadImage = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  const generatePreviews = async () => {
    setIsExporting(true);
    setExportProgress(0);
    const newPreviews = [];

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const pxCrop = pixelCrops[frame.id];
      const dims = imgDims[frame.id];
      
      try {
        const imageElement = await loadImage(frame.dataUrl);
        const blob = await getCroppedImg(imageElement, pxCrop, dims);
        const url = URL.createObjectURL(blob);
        const baseName = getCleanFileName(frame.fileName);
        const suffix = pxCrop ? "_crop" : "";
        const fileName = `${baseName}_${frame.formattedTime.replace(':', '-')}${suffix}_${i}.jpg`;
        
        newPreviews.push({ url, fileName, blob });
      } catch (err) {
        console.error("Failed to load image for preview", err);
      }
      
      setExportProgress(Math.round(((i + 1) / frames.length) * 100));
    }

    if (newPreviews.length === 0) {
      setIsExporting(false);
      return;
    }

    setPreviewImages(newPreviews);
    setPreviewMode(true);
    setIsExporting(false);
  };

  const downloadZip = async () => {
    setIsExporting(true);
    const zip = new JSZip();
    previewImages.forEach(img => {
      zip.file(img.fileName, img.blob);
    });
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'cropped_images.zip');
    setIsExporting(false);
    onClose();
  };

  // Close only when clicking the explicit X button, not the overlay, so progress isn't lost accidentally.
  const handleOverlayClick = (e) => {
    // Intentionally empty so clicking background doesn't close
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' && currentIndex < frames.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, frames.length]);

  return (
    <div className="batch-crop-overlay" onClick={handleOverlayClick}>
      <div className="batch-crop-modal" onClick={e => e.stopPropagation()}>
        
        <div className="batch-crop-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CropIcon size={24} color="var(--accent-color)" />
            <h2>Crop Selected Images ({currentIndex + 1} of {frames.length})</h2>
          </div>
          <button className="close-btn" onClick={onClose} title="Close without exporting">
            <X size={24} />
          </button>
        </div>

        {previewMode ? (
          <div className="preview-container">
            <div className="preview-grid">
              {previewImages.map((img, idx) => (
                <div key={idx} className="preview-card">
                  <img src={img.url} alt={`Preview ${idx}`} />
                  <div className="preview-name">{img.fileName}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="batch-crop-main-area">
              <div className="crop-workspace" ref={cropWorkspaceRef}>
                <ReactCrop
                  crop={currentCrop}
                  onChange={handleCropChange}
                  onComplete={handleCropComplete}
                >
                  <img 
                    src={currentFrame.dataUrl} 
                    alt="To crop" 
                    onLoad={(e) => handleImageLoad(e, currentFrame.id)}
                    className="crop-image"
                    style={{ maxHeight: `${maxImgH}px` }}
                  />
                </ReactCrop>
              </div>
            </div>

            {/* Carousel / Thumbnail Strip */}
            <div className="batch-crop-carousel">
              {frames.map((frame, index) => {
                const isActive = index === currentIndex;
                const isCropped = !!pixelCrops[frame.id];
                
                return (
                  <div 
                    key={frame.id}
                    className={`carousel-item ${isActive ? 'active' : ''}`}
                    onClick={() => setCurrentIndex(index)}
                    title={frame.formattedTime}
                  >
                    <img src={frame.dataUrl} alt={`Thumbnail ${index}`} />
                    {isCropped && (
                      <div className="carousel-badge">
                        <CheckCircle2 size={14} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="batch-crop-footer">
          {previewMode ? (
            <>
              <div className="footer-left">
                <button className="btn btn-secondary" onClick={() => setPreviewMode(false)}>
                  Back to Editing
                </button>
              </div>
              <div className="footer-right">
                {isExporting ? (
                  <div className="export-progress"><span>Zipping...</span></div>
                ) : (
                  <button className="btn btn-primary" onClick={downloadZip}>
                    <Download size={18} /> <span className="export-text">Confirm & Download ZIP</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="footer-left">
                <button className="btn btn-secondary" onClick={copyCropToAll}>
                  <Copy size={18} /> Apply This Crop to All
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Select photos from the carousel above to adjust their crop.
                </span>
              </div>
              
              <div className="footer-right">
                {isExporting ? (
                  <div className="export-progress">
                    <span>Processing... {exportProgress}%</span>
                  </div>
                ) : (
                  <button className="btn btn-primary" onClick={generatePreviews}>
                    <span className="export-text">Preview {frames.length} Cuts</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
