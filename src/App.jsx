import { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { UploadCloud, Check, Trash2, Download, Package, RefreshCw, Settings, Play, XSquare, Film, Trash, Maximize2, X, AlertCircle, ChevronLeft, ChevronRight, Crop } from 'lucide-react';
import { extractFrames } from './utils/VideoProcessor';
import GifMaker from './components/GifMaker';
import BatchCrop from './components/BatchCrop';
import './App.css';

function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [frames, setFrames] = useState([]);
  const [selectedFrameIds, setSelectedFrameIds] = useState(new Set());
  const [videoFiles, setVideoFiles] = useState([]); // Keep reference to uploaded files
  const [filterVideo, setFilterVideo] = useState('All'); // Filter state
  const [fps, setFps] = useState(1);
  const [showGifMaker, setShowGifMaker] = useState(false);
  const [showBatchCrop, setShowBatchCrop] = useState(false);
  
  // New States
  const [instantStart, setInstantStart] = useState(true);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [processingError, setProcessingError] = useState(null);
  const [previewFrame, setPreviewFrame] = useState(null);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const abortControllerRef = useRef(null);

  const fileInputRef = useRef(null);

  // Get unique video names for the filter dropdown
  const uniqueVideos = Array.from(new Set(frames.map(f => f.fileName)));
  const visibleFrames = frames.filter(f => filterVideo === 'All' || f.fileName === filterVideo);
  // Calculate selection based on visible frames
  const visibleSelectedCount = visibleFrames.filter(f => selectedFrameIds.has(f.id)).length;
  const isAllVisibleSelected = visibleFrames.length > 0 && visibleSelectedCount === visibleFrames.length;

  const navigatePreview = (direction, e) => {
    if (e) e.stopPropagation();
    if (!previewFrame || visibleFrames.length === 0) return;
    
    const currentIndex = visibleFrames.findIndex(f => f.id === previewFrame.id);
    if (currentIndex === -1) return;

    if (direction === 'next') {
      const nextIndex = (currentIndex + 1) % visibleFrames.length;
      setPreviewFrame(visibleFrames[nextIndex]);
    } else if (direction === 'prev') {
      const prevIndex = (currentIndex - 1 + visibleFrames.length) % visibleFrames.length;
      setPreviewFrame(visibleFrames[prevIndex]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!previewFrame || visibleFrames.length === 0) return;
      if (e.key === 'ArrowRight') {
        navigatePreview('next');
      } else if (e.key === 'ArrowLeft') {
        navigatePreview('prev');
      } else if (e.key === 'Escape') {
        setPreviewFrame(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewFrame, visibleFrames]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
    if (files.length > 0) {
      handleFiles(files);
    } else {
      alert('Please drop valid video files (MP4).');
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFiles = (files) => {
    // If instantStart is enabled and we are not currently managing a queue, process immediately.
    // Otherwise, add to the queue.
    if (instantStart && uploadQueue.length === 0) {
      processVideos(files);
    } else {
      setUploadQueue(prev => [...prev, ...files]);
    }
  };

  const processVideos = async (files) => {
    setVideoFiles(files); // Save for reprocessing
    setFilterVideo('All'); // Reset filter
    setIsProcessing(true);
    setProgress(0);
    setFrames([]);
    setSelectedFrameIds(new Set());
    setProcessingError(null);
    setUploadQueue([]);

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    let allFrames = [];

    try {
      for (let i = 0; i < files.length; i++) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        const file = files[i];
        setProgressText(`Processing video ${i + 1} of ${files.length}...`);
        
        const extractedFrames = await extractFrames(file, fps, (pct) => {
          const overallPct = ((i * 100) + pct) / files.length;
          setProgress(overallPct);
        }, signal);
        
        allFrames = [...allFrames, ...extractedFrames];
      }
      setFrames(allFrames);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Processing cancelled');
        setFrames(allFrames); // Keep frames extracted so far
      } else {
        console.error(err);
        setProcessingError(err.message || 'An unknown error occurred during processing.');
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const removeFromQueue = (index) => {
    setUploadQueue(prev => prev.filter((_, i) => i !== index));
  };

  const reprocess = () => {
    if (videoFiles.length > 0) {
      processVideos(videoFiles);
    }
  };

  const toggleSelection = (id) => {
    setSelectedFrameIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleCardClick = (frame, index, e) => {
    if (e.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(index, lastSelectedIndex);
      const end = Math.max(index, lastSelectedIndex);
      
      const framesToSelect = visibleFrames.slice(start, end + 1);
      
      setSelectedFrameIds(prev => {
        const newSet = new Set(prev);
        // We probably want to toggle, but shift click usually adds to selection or selects range.
        // Selecting range is what standard OS does for shift-click
        framesToSelect.forEach(f => newSet.add(f.id));
        return newSet;
      });
    } else {
      toggleSelection(frame.id);
    }
    setLastSelectedIndex(index);
  };

  const selectAll = () => {
    // Only select currently filtered frames
    const visibleFrames = frames.filter(f => filterVideo === 'All' || f.fileName === filterVideo);
    
    // Check if all visible frames are already selected
    const allVisibleSelected = visibleFrames.every(f => selectedFrameIds.has(f.id));

    if (allVisibleSelected) {
      // Deselect visible
      setSelectedFrameIds(prev => {
        const newSet = new Set(prev);
        visibleFrames.forEach(f => newSet.delete(f.id));
        return newSet;
      });
    } else {
      // Select visible
      setSelectedFrameIds(prev => {
        const newSet = new Set(prev);
        visibleFrames.forEach(f => newSet.add(f.id));
        return newSet;
      });
    }
  };

  const unselectFirstFrames = () => {
    setSelectedFrameIds(prev => {
      const newSet = new Set(prev);
      // Iterate through all frames and if timestamp === 0, remove from set
      frames.forEach(f => {
        if (f.timestamp === 0) {
          newSet.delete(f.id);
        }
      });
      return newSet;
    });
  };

  const selectFirstFrames = () => {
    setSelectedFrameIds(prev => {
      const newSet = new Set(prev);
      frames.forEach(f => {
        if (f.timestamp === 0 && (filterVideo === 'All' || f.fileName === filterVideo)) {
          newSet.add(f.id);
        }
      });
      return newSet;
    });
  };

  const deleteSelected = () => {
    setFrames(prev => prev.filter(f => !selectedFrameIds.has(f.id)));
    setSelectedFrameIds(new Set());
  };

  const deleteFrame = (id, e) => {
    e.stopPropagation(); // prevent selection toggle
    setFrames(prev => prev.filter(f => f.id !== id));
    setSelectedFrameIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const reset = () => {
    setFrames([]);
    // Move currently loaded videos back into the queue so they can be retained/managed
    setUploadQueue([...videoFiles]);
    setSelectedFrameIds(new Set());
    setProgress(0);
    setFilterVideo('All');
    setProcessingError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeVideo = (videoName) => {
    setFrames(prev => prev.filter(f => f.fileName !== videoName));
    setSelectedFrameIds(prev => {
      const newSet = new Set(prev);
      frames.filter(f => f.fileName === videoName).forEach(f => newSet.delete(f.id));
      return newSet;
    });
    setVideoFiles(prev => prev.filter(f => f.name !== videoName));
    setUploadQueue(prev => prev.filter(f => f.name !== videoName));
    setFilterVideo('All');
  };

  const getCleanFileName = (fileName) => {
    return fileName.replace(/\.[^/.]+$/, "");
  };

  const downloadZip = async () => {
    const targetFrames = selectedFrameIds.size > 0 
      ? frames.filter(f => selectedFrameIds.has(f.id))
      : frames;

    if (targetFrames.length === 0) return;

    const zip = new JSZip();
    targetFrames.forEach((frame, i) => {
      const data = frame.dataUrl.split(',')[1];
      const baseName = getCleanFileName(frame.fileName);
      // Append index `i` to prevent overwriting when multiple frames share the same formattedTime (e.g. same second)
      zip.file(`${baseName}_${frame.formattedTime.replace(':', '-')}_${i}.jpg`, data, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'video_frames.zip');
  };

  const downloadDirect = async () => {
    const targetFrames = selectedFrameIds.size > 0 
      ? frames.filter(f => selectedFrameIds.has(f.id))
      : frames;

    if (targetFrames.length === 0) return;

    for (let i = 0; i < targetFrames.length; i++) {
      const frame = targetFrames[i];
      const a = document.createElement('a');
      const baseName = getCleanFileName(frame.fileName);
      a.href = frame.dataUrl;
      a.download = `${baseName}_${frame.formattedTime.replace(':', '-')}_${i}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Short delay to avoid browser blocking multiple rapid downloads
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  };

  return (
    <div className="app-container">
      <header className="animate-fade-in">
        <h1>Video Image Cutter</h1>
        <p>Extract, review, and export frames from your video clips, entirely offline.</p>
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--accent-color)', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
            Coming Soon: Video Joiner 🎬
          </div>
        </div>
      </header>

      {/* Hidden File Input */}
      <input 
        type="file" 
        multiple
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept="video/*"
        onChange={handleFileSelect}
      />

      {/* Error Banner */}
      {processingError && !isProcessing && (
        <div className="glass-panel animate-fade-in" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--danger-color)', color: '#fca5a5', padding: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={20} />
            <span>{processingError}</span>
          </div>
          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={() => setProcessingError(null)}>Dismiss</button>
        </div>
      )}

      {/* Upload State */}
      {!isProcessing && frames.length === 0 && uploadQueue.length === 0 && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={20} color="var(--accent-color)" />
              <span style={{ fontWeight: 500 }}>Settings</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox"
                  checked={instantStart}
                  onChange={(e) => setInstantStart(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>Instant Start</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>FPS:</span>
                <input 
                  type="number" 
                  min="0.1" 
                  step="0.1"
                  value={fps} 
                  onChange={(e) => setFps(Number(e.target.value))}
                  style={{ 
                    width: '70px', 
                    padding: '0.4rem', 
                    borderRadius: '6px', 
                    border: '1px solid var(--glass-border)',
                    background: 'rgba(0,0,0,0.3)',
                    color: 'white',
                    textAlign: 'center'
                  }}
                />
              </div>
            </div>
          </div>

          <div 
            className={`upload-zone glass-panel ${isDragging ? 'drag-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud className="upload-icon" />
            <h2>Drag & Drop MP4s here</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>or click to browse (Multiple files supported)</p>
          </div>
        </div>
      )}

      {/* Queue State */}
      {!isProcessing && frames.length === 0 && uploadQueue.length > 0 && (
        <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Package size={24} color="var(--accent-color)" />
                Upload Queue
              </h2>
              <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                + Add More
              </button>
            </div>
            
            <div className="upload-queue">
              {uploadQueue.map((file, index) => (
                <div key={index} className="queue-item">
                  <div className="queue-item-info">
                    <span className="queue-item-name">{file.name}</span>
                    <span className="queue-item-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                  <button className="btn btn-danger" style={{ padding: '0.4rem' }} onClick={() => removeFromQueue(index)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => { setUploadQueue([]); setVideoFiles([]); }}>
                <RefreshCw size={18} /> Clear All
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>FPS:</span>
                  <input 
                    type="number" 
                    min="0.1" 
                    step="0.1"
                    value={fps} 
                    onChange={(e) => setFps(Number(e.target.value))}
                    style={{ 
                      width: '70px', 
                      padding: '0.4rem', 
                      borderRadius: '6px', 
                      border: '1px solid var(--glass-border)',
                      background: 'rgba(0,0,0,0.3)',
                      color: 'white',
                      textAlign: 'center'
                    }}
                  />
                </div>
                <button className="btn btn-primary" onClick={() => processVideos(uploadQueue)}>
                  <Play size={18} /> Start Processing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="glass-panel progress-container animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <h2>{progressText}</h2>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <p>{Math.round(progress)}% complete</p>
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
            <button className="btn btn-danger" onClick={cancelProcessing}>
              <XSquare size={18} /> Cancel Processing
            </button>
          </div>
        </div>
      )}

      {/* Gallery State */}
      {!isProcessing && frames.length > 0 && (
        <div className="animate-fade-in">
          
          {/* Top Controls Row */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', width: '100%' }}>
              <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Filter by Video:</span>
              <select 
                value={filterVideo} 
                onChange={(e) => setFilterVideo(e.target.value)}
                style={{
                  padding: '0.5rem',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,0.3)',
                  color: 'white',
                  border: '1px solid var(--glass-border)',
                  outline: 'none',
                  flex: 1,
                  minWidth: 0
                }}
              >
                <option value="All">All Videos</option>
                {uniqueVideos.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {filterVideo !== 'All' && (
                <button 
                  className="btn btn-danger" 
                  onClick={() => removeVideo(filterVideo)}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  <Trash2 size={16} /> Remove This Video
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>FPS:</span>
                <input 
                  type="number" 
                  min="0.1" 
                  step="0.1"
                  value={fps} 
                  onChange={(e) => setFps(Number(e.target.value))}
                  style={{ 
                    width: '60px', 
                    padding: '0.4rem', 
                    borderRadius: '4px', 
                    border: '1px solid var(--glass-border)',
                    background: 'rgba(0,0,0,0.3)',
                    color: 'white',
                    textAlign: 'center'
                  }}
                />
              </div>
              <button className="btn btn-primary" onClick={reprocess} style={{ padding: '0.5rem 1rem' }}>
                <Play size={16} /> Reprocess
              </button>
            </div>
          </div>

          {/* Action Bar */}
          <div className="action-bar glass-panel" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <div className="action-bar-info">
              <span style={{ fontWeight: 600 }}>{visibleFrames.length} {filterVideo === 'All' ? 'images total' : 'images in this video'}</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                ({selectedFrameIds.size} total selected)
              </span>
            </div>
            
            <div className="action-buttons" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={reset}>
                <RefreshCw size={18} /> Start Over
              </button>
              
              <button className="btn btn-secondary" onClick={selectAll}>
                <Check size={18} /> {isAllVisibleSelected ? 'Deselect Visible' : 'Select Visible'}
              </button>

              <button className="btn btn-secondary" onClick={selectFirstFrames}>
                <Check size={18} /> Select First Frames
              </button>

              <button className="btn btn-secondary" onClick={unselectFirstFrames}>
                <XSquare size={18} /> Unselect First Frames
              </button>
              
              <button 
                className="btn btn-danger" 
                disabled={selectedFrameIds.size === 0}
                onClick={deleteSelected}
              >
                <Trash2 size={18} /> Delete Selected
              </button>
              
              <button 
                className="btn btn-primary" 
                onClick={downloadDirect}
              >
                <Download size={18} /> Download Multiple
              </button>

              <button 
                className="btn btn-primary" 
                onClick={downloadZip}
              >
                <Package size={18} /> Export ZIP
              </button>

              <button 
                className="btn btn-primary" 
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}
                disabled={selectedFrameIds.size === 0}
                onClick={() => setShowGifMaker(true)}
              >
                <Film size={18} /> Make GIF
              </button>

              <button 
                className="btn btn-primary" 
                style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}
                disabled={selectedFrameIds.size === 0}
                onClick={() => setShowBatchCrop(true)}
              >
                <Crop size={18} /> Crop Selected
              </button>
            </div>
          </div>

          <div className="gallery">
            {visibleFrames.map((frame, index) => {
              const isSelected = selectedFrameIds.has(frame.id);
              return (
                <div 
                  key={frame.id} 
                  className={`image-card glass-panel ${isSelected ? 'selected' : ''}`}
                  onClick={(e) => handleCardClick(frame, index, e)}
                >
                  <img src={frame.dataUrl} alt={`Frame at ${frame.formattedTime}`} loading="lazy" />
                  <div className="checkbox-indicator">
                    {isSelected && <Check size={16} strokeWidth={3} />}
                  </div>
                  <button 
                    className="quick-preview-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewFrame(frame);
                    }}
                    title="Preview Frame"
                  >
                    <Maximize2 size={18} />
                  </button>
                  <button 
                    className="quick-delete-btn"
                    onClick={(e) => deleteFrame(frame.id, e)}
                    title="Delete Frame"
                  >
                    <Trash size={14} />
                  </button>
                  <div className="video-label-container" style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', zIndex: 10, maxWidth: 'calc(100% - 40px)' }}>
                    <div className="image-time" style={{ position: 'relative', top: 0, left: 0, bottom: 'auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {getCleanFileName(frame.fileName)}
                    </div>
                    <button 
                      className="quick-delete-video-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const frameCount = frames.filter(f => f.fileName === frame.fileName).length;
                        if (window.confirm(`Are you sure you want to delete all ${frameCount} photos from "${frame.fileName}"?`)) {
                          removeVideo(frame.fileName);
                        }
                      }}
                      title={`Exclude all images from ${frame.fileName}`}
                    >
                      <Trash size={12} /> All
                    </button>
                  </div>
                  <div className="image-time">{frame.formattedTime}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showGifMaker && (
        <GifMaker 
          frames={frames.filter(f => selectedFrameIds.has(f.id))}
          onClose={() => setShowGifMaker(false)}
        />
      )}

      {showBatchCrop && (
        <BatchCrop 
          frames={frames.filter(f => selectedFrameIds.has(f.id))}
          onClose={() => setShowBatchCrop(false)}
        />
      )}

      {/* Full-Screen Preview Modal */}
      {previewFrame && (
        <div className="preview-modal-overlay" onClick={() => setPreviewFrame(null)}>
          <div className="preview-modal-actions" onClick={e => e.stopPropagation()}>
            <button 
              className={`btn ${selectedFrameIds.has(previewFrame.id) ? 'btn-secondary' : 'btn-primary'}`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFrameIds(prev => {
                  const newSet = new Set(prev);
                  if (newSet.has(previewFrame.id)) {
                    newSet.delete(previewFrame.id);
                  } else {
                    newSet.add(previewFrame.id);
                  }
                  return newSet;
                });
              }}
              style={selectedFrameIds.has(previewFrame.id) ? {} : { background: 'var(--accent-color)' }}
            >
              <Check size={18} /> <span className="hide-mobile">{selectedFrameIds.has(previewFrame.id) ? 'Unselect' : 'Select'}</span>
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                const a = document.createElement('a');
                const baseName = getCleanFileName(previewFrame.fileName);
                a.href = previewFrame.dataUrl;
                a.download = `${baseName}_${previewFrame.formattedTime.replace(':', '-')}.jpg`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
            >
              <Download size={18} /> <span className="hide-mobile">Download</span>
            </button>
            <button 
              className="btn btn-danger"
              onClick={(e) => {
                e.stopPropagation();
                const currentIndex = visibleFrames.findIndex(f => f.id === previewFrame.id);
                const nextFrame = visibleFrames.length > 1 ? visibleFrames[(currentIndex + 1) % visibleFrames.length] : null;
                deleteFrame(previewFrame.id, e);
                setPreviewFrame(nextFrame);
              }}
            >
              <Trash size={18} /> <span className="hide-mobile">Delete</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setPreviewFrame(null)}>
              <X size={18} /> <span className="hide-mobile">Close</span>
            </button>
          </div>

          <button className="nav-btn prev-btn" onClick={(e) => navigatePreview('prev', e)}>
            <ChevronLeft size={36} />
          </button>

          <div className="preview-modal-content" onClick={e => e.stopPropagation()}>
            <img src={previewFrame.dataUrl} className="preview-modal-image" alt="Preview" />
          </div>

          <button className="nav-btn next-btn" onClick={(e) => navigatePreview('next', e)}>
            <ChevronRight size={36} />
          </button>
        </div>
      )}

    </div>
  );
}

export default App;
