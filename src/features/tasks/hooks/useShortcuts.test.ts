import { describe, expect, it } from 'vitest'
import { isTypingTarget } from './useShortcuts'

function el(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  return host.firstElementChild!
}

describe('isTypingTarget', () => {
  it.each([
    ['<input type="text">', true],
    ['<input type="search">', true],
    ['<input type="date">', true],
    ['<textarea></textarea>', true],
    ['<select></select>', true],
    ['<div contenteditable="true"></div>', true],
    ['<input type="checkbox">', false],
    ['<input type="radio">', false],
    ['<button>x</button>', false],
    ['<div contenteditable="false"></div>', false],
    ['<h3 tabindex="-1">Today</h3>', false],
  ])('%s -> %s', (html, expected) => {
    expect(isTypingTarget(el(html))).toBe(expected)
  })

  it('counts an element inside an editable region as typing', () => {
    const child = el('<div contenteditable="true"><span>x</span></div>').firstElementChild
    expect(isTypingTarget(child)).toBe(true)
  })
})
