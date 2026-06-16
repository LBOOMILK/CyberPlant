// 水晶龙特效 — 6色光球游走+呼吸
export default {
  name: 'crystal-dragon',
  icon: '🐉',
  init(container, options = {}) {
    const positions = [
      { x: 8, y: 10 },  { x: 68, y: 8 },
      { x: 15, y: 55 }, { x: 70, y: 55 },
      { x: 5, y: 70 },  { x: 75, y: 72 },
    ]
    const colorClasses = [
      { bg: 'rgba(255,60,60,0.85)', shadow: 'rgba(255,60,60,0.6)' },
      { bg: 'rgba(255,160,20,0.85)', shadow: 'rgba(255,160,20,0.6)' },
      { bg: 'rgba(255,240,40,0.85)', shadow: 'rgba(255,240,40,0.6)' },
      { bg: 'rgba(30,220,100,0.85)', shadow: 'rgba(30,220,100,0.6)' },
      { bg: 'rgba(40,140,255,0.85)', shadow: 'rgba(40,140,255,0.6)' },
      { bg: 'rgba(180,60,255,0.85)', shadow: 'rgba(180,60,255,0.6)' },
    ]
    const orbs = []
    const rafIds = []
    for (let i = 0; i < 6; i++) {
      const o = document.createElement('div')
      o.className = 'effect-orb'
      Object.assign(o.style, {
        position: 'absolute',
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        pointerEvents: 'none',
        filter: 'blur(1px)',
        background: `radial-gradient(circle, ${colorClasses[i].bg}, transparent)`,
        boxShadow: `0 0 22px ${colorClasses[i].shadow}`,
        left: positions[i].x + '%',
        top: positions[i].y + '%'
      })
      container.appendChild(o)
      orbs.push({
        el: o,
        x: positions[i].x,
        y: positions[i].y,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        phase: Math.random() * Math.PI * 2
      })
    }
    function tick() {
      if (!container.isConnected) return
      for (const orb of orbs) {
        orb.x += orb.vx
        orb.y += orb.vy
        if (orb.x < 0 || orb.x > 70) orb.vx *= -1
        if (orb.y < 0 || orb.y > 70) orb.vy *= -1
        orb.phase += 0.025
        const scale = 0.8 + 0.5 * Math.sin(orb.phase)
        orb.el.style.left = orb.x + '%'
        orb.el.style.top = orb.y + '%'
        orb.el.style.transform = 'scale(' + scale + ')'
        orb.el.style.opacity = (0.55 + 0.4 * Math.sin(orb.phase + 1.5)).toFixed(2)
      }
      rafIds.push(requestAnimationFrame(tick))
    }
    rafIds.push(requestAnimationFrame(tick))
    return {
      destroy() {
        rafIds.forEach(id => cancelAnimationFrame(id))
        orbs.forEach(o => o.el.remove())
      }
    }
  }
}
