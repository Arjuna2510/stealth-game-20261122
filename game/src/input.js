// input.js — keyboard + mouse state, in canvas (logical) coordinates.
// main.js polls this each frame; nothing else reads the DOM events directly.

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 };
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    keys.add(event.key.toLowerCase());
  });
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left - offsetX) / scale;
    mouse.y = (event.clientY - rect.top - offsetY) / scale;
  });
  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.clickX = (event.clientX - rect.left - offsetX) / scale;
    mouse.clickY = (event.clientY - rect.top - offsetY) / scale;
    mouse.clicked = true;
  });

  return {
    keys,
    mouse,
    // Called each frame after the canvas is fitted to the window.
    setViewTransform(s, ox, oy) {
      scale = s;
      offsetX = ox;
      offsetY = oy;
    },
    isDown(...names) {
      return names.some((name) => keys.has(name));
    },
    // Consume one click; returns the click point or null.
    takeClick() {
      if (!mouse.clicked) return null;
      mouse.clicked = false;
      return { x: mouse.clickX, y: mouse.clickY };
    },
    // True only on the frame the key was pressed. main.js clears it each frame.
    pressed: new Set(),
  };
}

// Track single-press keys (Enter, R) through the same keydown stream.
export function watchPresses(input, onPress) {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    onPress(event.key.toLowerCase());
  });
}
