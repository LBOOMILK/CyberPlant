// 雷霆鹰特效 — 6道闪电轨道旋转
export default {
  name: 'thunder-eagle',
  icon: '🦅',
  init(container, options = {}) {
    const bolts = []
    const cx = 50, cy = 50, r = 38
    const rafIds = []
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      const b = document.createElement('div')
      b.className = 'effect-bolt'
      b.textContent = '⚡'
      Object.assign(b.style, {
        position: 'absolute',
        fontSize: '30px',
        pointerEvents: 'none',
        filter: 'drop-shadow(0 0 12px rgba(255,220,30,0.9)) drop-shadow(0 0 24px rgba(255,180,20,0.5))',
        animation: `boltFlash ${0.5 + Math.random() * 0.5}s ease-in-out ${Math.random() * 0.7}s infinite`
      })
      b.style.left = (cx + r * Math.cos(angle)) + '%'
      b.style.top = (cy + r * Math.sin(angle)) + '%'
      container.appendChild(b)
      bolts.push({
        el: b,
        angle,
        speed: 0.015 + Math.random() * 0.005,
        orbitR: r + (Math.random() - 0.5) * 12
      })
    }
    function tick() {
      if (!container.isConnected) return
      for (const bolt of bolts) {
        bolt.angle += bolt.speed
        bolt.el.style.left = (cx + bolt.orbitR * Math.cos(bolt.angle)) + '%'
        bolt.el.style.top = (cy + bolt.orbitR * Math.sin(bolt.angle)) + '%'
      }
      rafIds.push(requestAnimationFrame(tick))
    }
    rafIds.push(requestAnimationFrame(tick))
    return {
      destroy() {
        rafIds.forEach(id => cancelAnimationFrame(id))
        bolts.forEach(b => b.el.remove())
      }
    }
  }
}
