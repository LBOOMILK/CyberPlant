import bubbleFish from './bubble-fish.js'
import catPaw from './cat-paw.js'
import starRabbit from './star-rabbit.js'
import thunderEagle from './thunder-eagle.js'
import crystalDragon from './crystal-dragon.js'
import lbooktest from './lbooktest.js'

const effects = {
  'bubble-fish': bubbleFish,
  'cat-paw': catPaw,
  'star-rabbit': starRabbit,
  'thunder-eagle': thunderEagle,
  'crystal-dragon': crystalDragon,
  'lbooktest': lbooktest,
}

export function loadEffect(name) {
  return effects[name] || null
}

export default effects
