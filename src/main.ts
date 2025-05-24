import { g } from './webgl/gl_init'
import { c } from './canvas'
import { Loop } from './loop_input'
import './style.css'
import { _init, _render, _update } from './ur.ts'
import a from './audio'
import Content from './content'

function app(el: HTMLElement) {

  let canvas = g.canvas

  Promise.all([
    a.load(),
    Content.load()
  ]).then(() => {
    g.load_sheet(new Image())
    _init()

    Loop(_update, _render)
  })

  canvas.classList.add('pixelated')


  let content = document.createElement('div')
  content.classList.add('content')

  content.appendChild(canvas)
  content.appendChild(c.canvas)
  el.appendChild(content)
}


app(document.querySelector('#app')!)