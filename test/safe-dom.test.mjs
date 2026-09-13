import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const forbidden = /document\.write(?:ln)?\s*\(|\.innerHTML\s*=/

class FakeNode {
  constructor(tag) {
    this.tagName = tag
    this.className = ''
    this.textContent = ''
    this.childNodes = []
  }

  append(...nodes) {
    this.childNodes.push(...nodes)
  }
}

globalThis.document = {
  createElement(tag) {
    return new FakeNode(tag)
  }
}

const { renderAccountRow, renderOpportunityCard } = await import('../renderer/safe-dom.js')

describe('safe DOM rendering', () => {
  for (const file of [
    'renderer/app.js',
    'renderer/safe-dom.js',
    'renderer/watch-party.js',
    'demo/recording.html'
  ]) {
    it(`${file} does not use document.write or innerHTML assignment`, () => {
      const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
      assert.equal(src.match(forbidden), null)
    })
  }

  it('keeps markup characters in account fields as text', () => {
    const row = renderAccountRow({
      name: '<img src=x onerror=alert(1)>',
      owner: '<script>evil()</script>',
      segment: 'Ultras',
      health: 'At Risk'
    })

    const name = row.childNodes[0].childNodes[0]
    const owner = row.childNodes[0].childNodes[1]
    const health = row.childNodes[1]

    assert.equal(name.tagName, 'strong')
    assert.equal(name.textContent, '<img src=x onerror=alert(1)>')
    assert.equal(owner.textContent, '<script>evil()</script> · Ultras')
    assert.equal(health.className, 'health health-At-Risk')
    assert.equal(health.textContent, 'At Risk')
    assert.equal(name.innerHTML, undefined)
  })

  it('keeps markup characters in prediction fields as text', () => {
    const card = renderOpportunityCard(
      {
        name: '<svg onload=alert(1)>',
        stage: 'Final',
        amount: 500,
        weightedAmount: 275,
        probability: 55,
        riskLabel: 'High',
        riskScore: 48,
        forecastCategory: 'Best Case',
        account: { name: 'Club <b>X</b>' }
      },
      (value) => String(value)
    )

    const title = card.childNodes[0].childNodes[0].childNodes[0]
    const meta = card.childNodes[0].childNodes[0].childNodes[1]
    const amount = card.childNodes[0].childNodes[1]
    const pills = card.childNodes[1].childNodes

    assert.equal(title.textContent, '<svg onload=alert(1)>')
    assert.equal(meta.textContent, 'Club <b>X</b> · Final')
    assert.equal(amount.textContent, '$500')
    assert.equal(pills[0].textContent, '55% confidence')
    assert.equal(pills[1].textContent, 'Weighted $275')
    assert.equal(pills[2].className, 'pill risk-High')
    assert.equal(pills[2].textContent, 'High risk (48)')
    assert.equal(pills[3].textContent, 'Best Case')
    assert.equal(title.innerHTML, undefined)
  })
})
