import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const fixtureUrl = `/@fs${fileURLToPath(new URL('../fixtures/removal.html', import.meta.url))}`
const moduleUrl = `/@fs${fileURLToPath(new URL('../../src/index.ts', import.meta.url))}`

for (const tag of ['ul', 'tbody'] as const) {
  for (const changePosition of [false, true]) {
    test(`removes an animating ${tag} child when parent positioning ${changePosition ? 'changes' : 'stays relative'}`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(fixtureUrl)
      await page.evaluate(async ({ moduleUrl, tag }) => {
        const { default: autoAnimate } = await import(moduleUrl)
        const host = document.querySelector('#fixture')!
        const parent = document.createElement(tag)
        if (tag === 'tbody') {
          const table = document.createElement('table')
          table.append(parent)
          host.append(table)
        } else {
          host.append(parent)
        }
        parent.id = 'list'
        autoAnimate(parent, { duration: 1000 })
        for (const id of ['removed', 'survivor']) {
          const child = document.createElement(tag === 'tbody' ? 'tr' : 'li')
          child.id = id
          if (tag === 'tbody') {
            const cell = document.createElement('td')
            cell.textContent = id
            child.append(cell)
          } else {
            child.textContent = id
          }
          parent.append(child)
        }
      }, { moduleUrl, tag })
      await page.waitForFunction(() =>
        document.querySelector('#removed')!.getAnimations().some(a => a.playState === 'running')
      )
      await page.evaluate(changePosition => {
        // A layout change makes an unobserved wrapper the positioned ancestor.
        if (changePosition) document.querySelector<HTMLElement>('#list')!.style.position = 'static'
        document.querySelector('#removed')!.remove()
        return new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      }, changePosition)
      expect(errors).toEqual([])
      await expect(page.locator('#removed')).toHaveCount(0)
      await expect(page.locator('#survivor')).toHaveCount(1)
    })
  }
}
