// 泡泡鱼特效 — 8个透明气泡上升
export default {
  name: 'bubble-fish',
  icon: '🐟',
  init(container, options = {}) {
    const spots = [
      { x: 10, y: 15 }, { x: 70, y: 10 }, { x: 15, y: 60 },
      { x: 72, y: 58 }, { x: 42, y: 5 }, { x: 45, y: 72 },
      { x: 5, y: 38 }, { x: 78, y: 35 },
    ]
    const bubbles = []
    for (let i = 0; i < spots.length; i++) {
      const b = document.createElement('div')
      b.className = 'effect-bubble'
      const size = 10 + Math.random() * 18
      Object.assign(b.style, {
        position: 'absolute',
        width: size + 'px',
        height: size + 'px',
        border: '2px solid rgba(0,255,255,0.4)',
        borderRadius: '50%',
        pointerEvents: 'none',
        left: spots[i].x + '%',
        top: spots[i].y + '%',
        animation: `bubbleUp ${2.5 + Math.random() * 2}s ease-in-out ${Math.random() * 3}s infinite`
      })
      container.appendChild(b)
      bubbles.push(b)
    }
    return {
      destroy() {
        bubbles.forEach(b => b.remove())
      }
    }
  }
}
