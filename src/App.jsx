import { useState, useRef } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { UploadCloud, Check, Trash2, Download, Package, RefreshCw, Settings, Play, XSquare, Film, Trash } from 'lucide-react';
import { extractFrames } from './utils/VideoProcessor';
import GifMaker from './components/GifMaker';
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
  const fileInputRef = useRef(null);

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
      processVideos(files);
    } else {
      alert('Please drop valid video files (MP4).');
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      processVideos(files);
    }
  };

  const processVideos = async (files) => {
    setVideoFiles(files); // Save for reprocessing
    setFilterVideo('All'); // Reset filter
    setIsProcessing(true);
    setProgress(0);
    setFrames([]);
    setSelectedFrameIds(new Set());

    let allFrames = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgressText(`Processing video ${i + 1} of ${files.length}...`);
        
        const extractedFrames = await extractFrames(file, fps, (pct) => {
          const overallPct = ((i * 100) + pct) / files.length;
          setProgress(overallPct);
        });
        
        allFrames = [...allFrames, ...extractedFrames];
      }
      setFrames(allFrames);
    } catch (err) {
      console.error(err);
      alert('Error processing video: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
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
    setVideoFiles([]);
    setSelectedFrameIds(new Set());
    setProgress(0);
    setFilterVideo('All');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
    targetFrames.forEach((frame) => {
      const data = frame.dataUrl.split(',')[1];
      const baseName = getCleanFileName(frame.fileName);
      zip.file(`${baseName}_${frame.formattedTime.replace(':', '-')}.jpg`, data, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'video_frames.zip');
  };

  const downloadDirect = () => {
    const targetFrames = selectedFrameIds.size > 0 
      ? frames.filter(f => selectedFrameIds.has(f.id))
      : frames;

    if (targetFrames.length === 0) return;

    targetFrames.forEach((frame) => {
      const a = document.createElement('a');
      const baseName = getCleanFileName(frame.fileName);
      a.href = frame.dataUrl;
      a.download = `${baseName}_${frame.formattedTime.replace(':', '-')}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  };

  // Get unique video names for the filter dropdown
  const uniqueVideos = Array.from(new Set(frames.map(f => f.fileName)));
  const visibleFrames = frames.filter(f => filterVideo === 'All' || f.fileName === filterVideo);
  // Calculate selection based on visible frames
  const visibleSelectedCount = visibleFrames.filter(f => selectedFrameIds.has(f.id)).length;
  const isAllVisibleSelected = visibleFrames.length > 0 && visibleSelectedCount === visibleFrames.length;

  return (
    <div className="app-container">
      <header className="animate-fade-in">
        <h1>Video Image Cutter</h1>
        <p>Extract, review, and export frames from your video clips, entirely offline.</p>
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--accent-color)', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }}>Phone Access URL:</span>
            <strong style={{ color: 'white', letterSpacing: '0.5px' }}>http://{__LOCAL_IP__}:5173</strong>
          </div>
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
            Coming Soon: Video Joiner 🎬
          </div>
        </div>
      </header>

      {/* Upload State */}
      {!isProcessing && frames.length === 0 && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={20} color="var(--accent-color)" />
              <span style={{ fontWeight: 500 }}>Extraction Interval</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="number" 
                min="0.1" 
                step="0.1"
                value={fps} 
                onChange={(e) => setFps(Number(e.target.value))}
                style={{ 
                  width: '70px', 
                  padding: '0.5rem', 
                  borderRadius: '6px', 
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(0,0,0,0.3)',
                  color: 'white',
                  textAlign: 'center'
                }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>frames per second</span>
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
            <input 
              type="file" 
              multiple
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="video/*"
              onChange={handleFileSelect}
            />
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
        </div>
      )}

      {/* Gallery State */}
      {!isProcessing && frames.length > 0 && (
        <div className="animate-fade-in">
          
          {/* Top Controls Row */}
          <div className="glass-panel" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Filter by Video:</span>
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
                  minWidth: '200px'
                }}
              >
                <option value="All">All Videos</option>
                {uniqueVideos.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

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
            </div>
          </div>

          <div className="gallery">
            {visibleFrames.map(frame => {
              const isSelected = selectedFrameIds.has(frame.id);
              return (
                <div 
                  key={frame.id} 
                  className={`image-card glass-panel ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleSelection(frame.id)}
                >
                  <img src={frame.dataUrl} alt={`Frame at ${frame.formattedTime}`} loading="lazy" />
                  <div className="checkbox-indicator">
                    {isSelected && <Check size={16} strokeWidth={3} />}
                  </div>
                  <button 
                    className="quick-delete-btn"
                    onClick={(e) => deleteFrame(frame.id, e)}
                    title="Delete Frame"
                  >
                    <Trash size={14} />
                  </button>
                  <div className="image-time" style={{ bottom: 'auto', top: '8px', left: '8px' }}>
                    {getCleanFileName(frame.fileName)}
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
    </div>
  );
}

export default App;
