import React, { useState, useRef, useEffect } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { X, Download, Copy, Crop as CropIcon, CheckCircle2 } from 'lucide-react';
import './BatchCrop.css';

export default function BatchCrop({ frames, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [crops, setCrops] = useState({}); // { frameId: cropObject }
  const [completedCrops, setCompletedCrops] = useState({}); // To hold pixel-based crops
  const [imgRefs, setImgRefs] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewImages, setPreviewImages] = useState([]);
  
  const currentFrame = frames[currentIndex];
  const currentCrop = crops[currentFrame.id];

  const handleImageLoad = (e, frameId) => {
    setImgRefs(prev => ({ ...prev, [frameId]: e.currentTarget }));
  };

  const handleCropChange = (crop, percentCrop) => {
    setCrops(prev => ({ ...prev, [currentFrame.id]: percentCrop }));
  };

  const handleCropComplete = (crop, percentCrop) => {
    if (percentCrop && percentCrop.width > 0 && percentCrop.height > 0) {
      setCompletedCrops(prev => ({ ...prev, [currentFrame.id]: percentCrop }));
    } else {
      setCompletedCrops(prev => {
        const newCrops = { ...prev };
        delete newCrops[currentFrame.id];
        return newCrops;
      });
    }
  };

  const copyCropToAll = () => {
    const currentPercentCrop = crops[currentFrame.id];
    const currentCompletedCrop = completedCrops[currentFrame.id];
    
    if (!currentPercentCrop || !currentCompletedCrop) {
      alert("Please draw a crop area on the current image first.");
      return;
    }

    const newCrops = { ...crops };
    const newCompletedCrops = { ...completedCrops };

    frames.forEach(f => {
      newCrops[f.id] = { ...currentPercentCrop };
      newCompletedCrops[f.id] = { ...currentCompletedCrop };
    });

    setCrops(newCrops);
    setCompletedCrops(newCompletedCrops);
  };

  const getCleanFileName = (fileName) => {
    return fileName.replace(/\.[^/.]+$/, "");
  };

  const getCroppedImg = async (imageElement, percentCrop, frame) => {
    const canvas = document.createElement('canvas');
    
    if (!percentCrop || percentCrop.width === 0 || percentCrop.height === 0) {
      canvas.width = imageElement.naturalWidth;
      canvas.height = imageElement.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageElement, 0, 0);
    } else {
      const cropX = (percentCrop.x / 100) * imageElement.naturalWidth;
      const cropY = (percentCrop.y / 100) * imageElement.naturalHeight;
      const cropWidth = (percentCrop.width / 100) * imageElement.naturalWidth;
      const cropHeight = (percentCrop.height / 100) * imageElement.naturalHeight;

      canvas.width = Math.floor(cropWidth);
      canvas.height = Math.floor(cropHeight);
      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        imageElement,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.95);
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
      const crop = completedCrops[frame.id];
      
      try {
        const imageElement = await loadImage(frame.dataUrl);
        const blob = await getCroppedImg(imageElement, crop, frame);
        const url = URL.createObjectURL(blob);
        const baseName = getCleanFileName(frame.fileName);
        const suffix = crop ? "_crop" : "";
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
              <div className="crop-workspace">
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
                  />
                </ReactCrop>
              </div>
            </div>

            {/* Carousel / Thumbnail Strip */}
            <div className="batch-crop-carousel">
              {frames.map((frame, index) => {
                const isActive = index === currentIndex;
                const isCropped = !!completedCrops[frame.id];
                
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
