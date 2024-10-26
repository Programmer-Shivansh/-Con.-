from flask import Flask, Response, request
from flask_cors import CORS
import pyautogui
import numpy as np
import cv2
import base64
from mss import mss  # Much faster than PIL.ImageGrab
import json
import threading
from io import BytesIO
import time

app = Flask(__name__)
CORS(app)

# Global variables
current_frame = None
sct = mss()  # Screen capture object
monitor = sct.monitors[1]  # Primary monitor
COMPRESSION_QUALITY = 30  # Lower value = more compression
FRAME_RATE = 30  # Target FPS
FRAME_INTERVAL = 1 / FRAME_RATE

def compress_frame(frame):
    """Compress frame with optimal settings"""
    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), COMPRESSION_QUALITY]
    _, buffer = cv2.imencode('.jpg', frame, encode_param)
    return base64.b64encode(buffer).decode('utf-8')

def capture_screen():
    """Optimized screen capture function"""
    global current_frame
    last_capture = 0
    
    while True:
        current_time = time.time()
        if current_time - last_capture < FRAME_INTERVAL:
            time.sleep(0.001)  # Small sleep to prevent CPU overuse
            continue
            
        try:
            # Capture screen (much faster than PIL.ImageGrab)
            frame = np.array(sct.grab(monitor))
            
            # Resize frame to reduce size (adjust scale factor as needed)
            scale_factor = 0.75
            width = int(frame.shape[1] * scale_factor)
            height = int(frame.shape[0] * scale_factor)
            frame = cv2.resize(frame, (width, height), interpolation=cv2.INTER_NEAREST)
            
            # Convert to BGR (required for cv2)
            frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
            
            # Compress and encode frame
            current_frame = compress_frame(frame)
            last_capture = current_time
            
        except Exception as e:
            print(f"Capture error: {e}")
            time.sleep(0.1)

@app.route('/screen')
def get_screen():
    """Return the latest screen capture"""
    if current_frame:
        return Response(
            json.dumps({'image': current_frame}),
            mimetype='application/json',
            headers={
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        )
    return Response('No frame available', status=404)

# Mouse movement queue and handler
mouse_queue = []
def mouse_handler():
    """Handle mouse movements in batch"""
    while True:
        if mouse_queue:
            # Get latest mouse position
            data = mouse_queue[-1]
            mouse_queue.clear()
            
            # Move mouse
            pyautogui.moveTo(data['x'], data['y'], duration=0)
        time.sleep(0.016)  # ~60Hz update rate

@app.route('/mouse', methods=['POST'])
def control_mouse():
    """Handle mouse control commands"""
    data = request.json
    action = data.get('action')
    x = data.get('x')
    y = data.get('y')
    
    if action == 'move':
        mouse_queue.append({'x': x, 'y': y})
    elif action == 'click':
        button = data.get('button', 'left')
        pyautogui.click(x=x, y=y, button=button)
    
    return Response('OK')

@app.route('/keyboard', methods=['POST'])
def control_keyboard():
    """Handle keyboard input"""
    data = request.json
    key = data.get('key')
    if key:
        pyautogui.press(key)
    return Response('OK')

if __name__ == '__main__':
    # Start screen capture thread
    capture_thread = threading.Thread(target=capture_screen)
    capture_thread.daemon = True
    capture_thread.start()
    
    # Start mouse handler thread
    mouse_thread = threading.Thread(target=mouse_handler)
    mouse_thread.daemon = True
    mouse_thread.start()
    
    # Start server with optimal settings
    from waitress import serve
    print("Server starting on port 5005...")
    serve(app, host="0.0.0.0", port=5005, threads=4)