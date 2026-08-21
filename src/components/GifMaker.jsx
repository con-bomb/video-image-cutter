import { useState, useRef, useEffect } from 'react';
import gifshot from 'gifshot';
import { X, Play, Download, Settings, RefreshCcw } from 'lucide-react';
import './GifMaker.css';
import { saveAs } from 'file-saver';

function GifMaker({ frames, onClose }) {
  const [gifFrames, setGifFrames] = useState(frames);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gifUrl, setGifUrl] = useState(null);
  const [interval, setIntervalTime] = useState(0.2); // 200ms per frame

  // Handle Drag and Drop for reordering
  const onDragStart = (e, index) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires setting data
    e.dataTransfer.setData('text/plain', index);
    // Timeout for dragging visual
    setTimeout(() => {
      e.target.style.opacity = '0.5';
    }, 0);
  };

  const onDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedItemIndex(null);
  };

  const onDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    
    setGifFrames(prevFrames => {
      const newFrames = [...prevFrames];
      const draggedItem = newFrames[draggedItemIndex];
      newFrames.splice(draggedItemIndex, 1);
      newFrames.splice(index, 0, draggedItem);
      return newFrames;
    });
    setDraggedItemIndex(index);
  };

  const generateGif = () => {
    if (gifFrames.length === 0) return;
    
    setIsGenerating(true);
    setProgress(0);
    setGifUrl(null);

    // Extract base64 images from frames
    const images = gifFrames.map(f => f.dataUrl);

    // Get original image dimensions to prevent small/stretched gifs
    const img = new Image();
    img.onload = () => {
      // Scale down slightly if massive to prevent crashes, but keep aspect ratio
      const MAX_WIDTH = 800;
      let targetWidth = img.naturalWidth;
      let targetHeight = img.naturalHeight;

      if (targetWidth > MAX_WIDTH) {
        const ratio = MAX_WIDTH / targetWidth;
        targetWidth = MAX_WIDTH;
        targetHeight = Math.floor(targetHeight * ratio);
      }

      gifshot.createGIF({
        images: images,
        interval: interval,
        gifWidth: targetWidth || 400,
        gifHeight: targetHeight || 300,
        numFrames: 10,
        frameDuration: 1,
        fontWeight: 'normal',
        fontSize: '16px',
        fontFamily: 'sans-serif',
        fontColor: '#ffffff',
        textAlign: 'center',
        textBaseline: 'bottom',
        sampleInterval: 10, 
        numWorkers: 2,
        progressCallback: (captureProgress) => {
          setProgress(captureProgress * 100);
        }
      }, (obj) => {
        if (!obj.error) {
          setGifUrl(obj.image);
        } else {
          alert('Error generating GIF');
        }
        setIsGenerating(false);
      });
    };
    img.src = images[0];
  };

  const downloadGif = () => {
    if (gifUrl) {
      saveAs(gifUrl, 'animated_export.gif');
    }
  };

  const removeFrame = (id) => {
    setGifFrames(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="modal-overlay animate-fade-in">
      <div className="modal-content glass-panel">
        
        <div className="modal-header">
          <h2>GIF Maker Studio</h2>
          <button className="btn-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {!gifUrl && !isGenerating && (
          <div className="gif-maker-workspace">
            <div className="gif-controls glass-panel">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <Settings size={20} color="var(--accent-color)" />
                <label style={{ color: 'white' }}>Frame Delay (seconds):</label>
                <input 
                  type="number" 
                  min="0.1" 
                  step="0.1" 
                  value={interval}
                  onChange={e => setIntervalTime(Number(e.target.value))}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '6px',
                    background: 'rgba(0,0,0,0.3)',
                    color: 'white',
                    border: '1px solid var(--glass-border)',
                    width: '70px',
                    textAlign: 'center'
                  }}
                />
              </div>
              <button 
                className="btn btn-primary" 
                onClick={generateGif}
                disabled={gifFrames.length < 2}
              >
                <Play size={18} /> Generate GIF
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Drag and drop frames to reorder them. ({gifFrames.length} frames)
            </p>

            <div className="dnd-gallery">
              {gifFrames.map((frame, index) => (
                <div 
                  key={frame.id}
                  className="dnd-item"
                  draggable
                  onDragStart={(e) => onDragStart(e, index)}
                  onDragEnd={onDragEnd}
                  onDragOver={(e) => onDragOver(e, index)}
                  title="Drag to reorder"
                >
                  <img src={frame.dataUrl} alt={`Frame ${index}`} />
                  <div className="dnd-number">{index + 1}</div>
                  <button 
                    className="quick-delete-btn" 
                    style={{ opacity: 1, padding: '4px' }}
                    onClick={() => removeFrame(frame.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            
            {gifFrames.length < 2 && (
              <p style={{ color: 'var(--danger-color)', textAlign: 'center', marginTop: '2rem' }}>
                You need at least 2 frames to make a GIF!
              </p>
            )}
          </div>
        )}

        {isGenerating && (
          <div className="generating-state">
            <h3>Generating GIF...</h3>
            <div className="progress-bar-bg" style={{ width: '100%', maxWidth: '400px', margin: '1rem auto' }}>
              <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <p>{Math.round(progress)}% complete</p>
          </div>
        )}

        {gifUrl && (
          <div className="result-state">
            <h3>Your GIF is Ready!</h3>
            <img src={gifUrl} alt="Generated GIF" className="gif-preview" />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setGifUrl(null)}>
                <RefreshCcw size={18} /> Edit Frames
              </button>
              <button className="btn btn-primary" onClick={downloadGif}>
                <Download size={18} /> Download GIF
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default GifMaker;
