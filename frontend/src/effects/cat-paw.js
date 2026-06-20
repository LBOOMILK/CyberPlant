// 小豆猫特效 — 8个爪印渐隐环绕
export default {
  name: 'cat-paw',
  icon: '🐱',
  init(container, options = {}) {
    const scale = options.scale || 1
    const pawPositions = [
      { left: 8, top: 15 }, { left: 75, top: 10 },
      { left: 12, top: 65 }, { left: 78, top: 60 },
      { left: 5, top: 40 }, { left: 82, top: 38 },
      { left: 45, top: 8 }, { left: 48, top: 72 },
    ]
    const paws = []
    for (let i = 0; i < pawPositions.length; i++) {
      const p = document.createElement('div')
      p.className = 'effect-paw'
      p.textContent = '🐾'
      Object.assign(p.style, {
        position: 'absolute',
        opacity: '0',
        pointerEvents: 'none',
        filter: 'drop-shadow(0 0 6px rgba(255,180,100,0.6))',
        left: pawPositions[i].left + '%',
        top: pawPositions[i].top + '%',
        fontSize: (18 + Math.random() * 14) * scale + 'px',
        animation: `pawFade 2s ease-in-out ${i * 0.35}s infinite`
      })
      container.appendChild(p)
      paws.push(p)
    }
    return {
      destroy() {
        paws.forEach(p => p.remove())
      }
    }
  }
}
