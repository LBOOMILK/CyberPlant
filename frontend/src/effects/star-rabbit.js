// 星光兔特效 — 12个金色粒子向外飘散
export default {
  name: 'star-rabbit',
  icon: '🐰',
  init(container, options = {}) {
    const scale = options.scale || 1
    const sparkles = []
    for (let i = 0; i < 12; i++) {
      const s = document.createElement('div')
      s.className = 'effect-sparkle'
      const sx = (Math.random() * 60 - 30) * scale + 'px'
      const sy = (Math.random() * 60 - 30) * scale + 'px'
      Object.assign(s.style, {
        position: 'absolute',
        width: 6 * scale + 'px',
        height: 6 * scale + 'px',
        background: '#ffd700',
        borderRadius: '50%',
        boxShadow: '0 0 8px #ffd700, 0 0 20px #ffa500',
        pointerEvents: 'none',
        left: (30 + Math.random() * 40) + '%',
        top: (30 + Math.random() * 40) + '%',
        '--sx': sx,
        '--sy': sy,
        animation: `sparkleDrift 2.5s ease-in-out ${Math.random() * 2.5}s infinite`
      })
      container.appendChild(s)
      sparkles.push(s)
    }
    return {
      destroy() {
        sparkles.forEach(s => s.remove())
      }
    }
  }
}
