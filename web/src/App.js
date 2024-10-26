import React, { useState, useEffect, useCallback, useRef } from 'react';

const PORT = 'http://192.168.41.62:5005';
const FRAME_INTERVAL = 33; // ~30 FPS

const RemoteControl = () => {
  const [screenImage, setScreenImage] = useState('');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const lastMouseMove = useRef(0);
  const mouseThrottle = 16; // ~60 FPS for mouse movement
  const screenRef = useRef(null);
  const frameRequest = useRef(null);

  // Optimized screen fetching using RAF
  const fetchScreen = useCallback(async () => {
    try {
      const response = await fetch(`${PORT}/screen`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const data = await response.json();
      setScreenImage(data.image);
    } catch (error) {
      console.error('Error fetching screen:', error);
    }
    
    frameRequest.current = setTimeout(() => {
      requestAnimationFrame(fetchScreen);
    }, FRAME_INTERVAL);
  }, []);

  // Cleanup function
  useEffect(() => {
    fetchScreen();
    return () => {
      if (frameRequest.current) {
        clearTimeout(frameRequest.current);
      }
    };
  }, [fetchScreen]);

  // Throttled mouse move handler
  const handleMouseMove = useCallback((e) => {
    const now = performance.now();
    if (now - lastMouseMove.current < mouseThrottle) return;
    
    const rect = screenRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    
    lastMouseMove.current = now;
    
    fetch(`${PORT}/mouse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move', x, y })
    }).catch(console.error);
  }, []);

  // Memoized click handler
  const handleClick = useCallback((button) => {
    const rect = screenRef.current?.getBoundingClientRect();
    if (!rect) return;

    fetch(`${PORT}/mouse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'click',
        button,
        x: Math.round(rect.x),
        y: Math.round(rect.y)
      })
    }).catch(console.error);
  }, []);

  // Memoized key handler
  const handleKey = useCallback((key) => {
    fetch(`${PORT}/keyboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    }).catch(console.error);
  }, []);

  const commonKeys = ['enter', 'space', 'backspace', 'tab', 'esc'];

  const styles = {
    container: {
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
    },
    screenContainer: {
      border: '1px solid #ccc',
      borderRadius: '8px',
      padding: '10px',
      marginBottom: '20px',
      backgroundColor: '#fff',
    },
    buttonContainer: {
      display: 'flex',
      gap: '10px',
      marginBottom: '20px',
    },
    button: {
      padding: '8px 16px',
      backgroundColor: '#007bff',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      WebkitTapHighlightColor: 'transparent',
      touchAction: 'manipulation',
    },
    keyboardContainer: {
      border: '1px solid #ccc',
      borderRadius: '8px',
      padding: '15px',
      backgroundColor: '#fff',
    },
    keyboardGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '8px',
    },
    keyButton: {
      padding: '8px',
      backgroundColor: '#f0f0f0',
      border: '1px solid #ccc',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      WebkitTapHighlightColor: 'transparent',
      touchAction: 'manipulation',
    },
    image: {
      width: '100%',
      display: 'block',
      imageRendering: 'pixelated', // Faster rendering
      transform: 'translateZ(0)', // Force GPU acceleration
      willChange: 'transform', // Hint for browser optimization
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.screenContainer}>
        <div>
          {screenImage && (
            <img
              ref={screenRef}
              id="screen"
              src={`data:image/jpeg;base64,${screenImage}`}
              alt="Remote Screen"
              style={styles.image}
              onMouseMove={handleMouseMove}
              draggable={false}
            />
          )}
        </div>
      </div>
      
      <div style={styles.buttonContainer}>
        <button 
          style={styles.button}
          onClick={() => handleClick('left')}
        >
          Left Click
        </button>
        <button 
          style={styles.button}
          onClick={() => handleClick('right')}
        >
          Right Click
        </button>
        <button 
          style={styles.button}
          onClick={() => setShowKeyboard(!showKeyboard)}
        >
          {showKeyboard ? 'Hide Keyboard' : 'Show Keyboard'}
        </button>
      </div>

      {showKeyboard && (
        <div style={styles.keyboardContainer}>
          <div style={styles.keyboardGrid}>
            {commonKeys.map(key => (
              <button
                key={key}
                onClick={() => handleKey(key)}
                style={styles.keyButton}
              >
                {key.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RemoteControl;