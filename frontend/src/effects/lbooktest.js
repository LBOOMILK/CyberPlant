// LBOOKTest 特效 — 竹子摇摆+赛博像素+数字雨+光环扩散
export default {
  name: 'lbooktest',
  icon: '🐼',
  init(container, options = {}) {
    const allElements = []
    const rafIds = []

    // 竹子
    const stalks = []
    const bambooPositions = [
      { left: 0, top: 32, size: 36 },
      { left: 5, top: 50, size: 34 },
      { left: 10, top: 62, size: 34 },
      { left: 60, top: 62, size: 34 },
      { left: 68, top: 50, size: 34 },
      { left: 73, top: 32, size: 36 },
    ]
    for (const pos of bambooPositions) {
      const b = document.createElement('div')
      b.textContent = '🎋'
      Object.assign(b.style, {
        position: 'absolute',
        fontSize: pos.size + 'px',
        pointerEvents: 'none',
        transformOrigin: 'bottom center',
        filter: 'drop-shadow(0 0 8px rgba(0,255,136,0.5)) drop-shadow(0 0 20px rgba(0,200,100,0.3))',
        left: pos.left + '%',
        top: pos.top + '%'
      })
      container.appendChild(b)
      allElements.push(b)
      stalks.push({ el: b, phase: Math.random() * Math.PI * 2, speed: 0.5 + Math.random() * 0.8 })
    }

    // 数字雨
    const rainDrops = []
    const rainCols = [24, 48, 72]
    for (let colIdx = 0; colIdx < rainCols.length; colIdx++) {
      for (let i = 0; i < 4; i++) {
        const ch = document.createElement('div')
        ch.textContent = Math.random() > 0.5 ? '0' : '1'
        Object.assign(ch.style, {
          position: 'absolute',
          fontSize: '12px',
          fontFamily: "'Courier New', monospace",
          color: 'rgba(0,255,136,0.85)',
          pointerEvents: 'none',
          left: rainCols[colIdx] + '%',
          top: (Math.random() * 100) + '%'
        })
        container.appendChild(ch)
        allElements.push(ch)
        rainDrops.push({
          el: ch,
          y: parseFloat(ch.style.top),
          speed: 0.1 + Math.random() * 0.3,
          col: rainCols[colIdx]
        })
      }
    }

    // 赛博像素
    const pixels = []
    for (let i = 0; i < 15; i++) {
      const pixel = document.createElement('div')
      const x = 3 + Math.random() * 90
      const y = 3 + Math.random() * 90
      Object.assign(pixel.style, {
        position: 'absolute',
        width: '3px',
        height: '3px',
        background: '#00ff88',
        pointerEvents: 'none',
        left: x + '%',
        top: y + '%',
        animation: `pixelBlink 1.2s ease-in-out ${Math.random() * 1.2}s infinite`
      })
      container.appendChild(pixel)
      allElements.push(pixel)
      pixels.push({ el: pixel, x, y, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3 })
    }

    // 光环
    for (let i = 0; i < 3; i++) {
      const ring = document.createElement('div')
      Object.assign(ring.style, {
        position: 'absolute',
        width: '20px',
        height: '20px',
        border: '1px solid rgba(0,255,136,0.3)',
        borderRadius: '50%',
        pointerEvents: 'none',
        left: '42%',
        top: '42%',
        animation: `ringPulse 2s ease-in-out ${i * 0.7}s infinite`
      })
      container.appendChild(ring)
      allElements.push(ring)
    }

    function tick() {
      if (!container.isConnected) return
      const t = Date.now() / 1000
      // 竹子摇摆
      for (const s of stalks) {
        const angle = Math.sin(t * s.speed + s.phase) * 5
        s.el.style.transform = 'rotate(' + angle + 'deg)'
      }
      // 数字雨
      for (const d of rainDrops) {
        d.y += d.speed
        if (d.y > 95) { d.y = -5; d.el.textContent = Math.random() > 0.5 ? '0' : '1' }
        d.el.style.top = d.y + '%'
        d.el.style.opacity = d.y < 0 ? 0 : d.y > 80 ? (95 - d.y) / 15 : 0.85
      }
      // 像素漂移
      for (const p of pixels) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > 90) p.vx *= -1
        if (p.y < 0 || p.y > 90) p.vy *= -1
        p.el.style.left = p.x + '%'
        p.el.style.top = p.y + '%'
      }
      rafIds.push(requestAnimationFrame(tick))
    }
    rafIds.push(requestAnimationFrame(tick))

    return {
      destroy() {
        rafIds.forEach(id => cancelAnimationFrame(id))
        allElements.forEach(el => el.remove())
      }
    }
  }
}
