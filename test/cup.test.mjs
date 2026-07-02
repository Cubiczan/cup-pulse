import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  accountSnapshot,
  enrichOpportunities,
  filterByOwner,
  forecastCategory,
  riskLabel,
  scoreDealRisk,
  summarizeOwners,
  summarizePipeline
} from '../shared/cup.mjs'

const seed = JSON.parse(readFileSync(new URL('../shared/seed.json', import.meta.url), 'utf8'))

const data = {
  accounts: [
    {
      id: 'club-a',
      name: 'Metro Ultras',
      owner: 'Maya Chen',
      health: 'At Risk',
      arr: 4200
    },
    {
      id: 'club-b',
      name: 'Kickoff Crew',
      owner: 'Jordan Lee',
      health: 'Healthy',
      arr: 1800
    }
  ],
  opportunities: [
    {
      id: 'pred-a',
      accountId: 'club-a',
      name: 'QF upset call',
      stage: 'Quarter-Final',
      amount: 150000,
      probability: 40,
      closeDate: '2026-07-10',
      nextStep: '',
      lastActivityDays: 28,
      contactCoverage: 1
    },
    {
      id: 'pred-b',
      accountId: 'club-b',
      name: 'Final berth',
      stage: 'Semi-Final',
      amount: 50000,
      probability: 70,
      closeDate: '2026-07-14',
      nextStep: 'Confirm pool rules',
      lastActivityDays: 3,
      contactCoverage: 3
    }
  ],
  contacts: [{ id: 'contact-a', accountId: 'club-a', name: 'Alex Capitan' }],
  tasks: [
    { id: 'task-a', accountId: 'club-a', dueDate: '2026-06-28', status: 'open' },
    { id: 'task-b', accountId: 'club-b', dueDate: '2026-07-12', status: 'open' }
  ],
  activities: [{ id: 'activity-a', accountId: 'club-a', summary: 'No venue booked.' }]
}

describe('scoreDealRisk', () => {
  it('scores stale predictions with missing next steps as critical risk', () => {
    const score = scoreDealRisk(data.opportunities[0], data.accounts[0])

    assert.equal(score, 100)
    assert.equal(riskLabel(score), 'Critical')
  })

  it('keeps active semi-final predictions low risk', () => {
    const score = scoreDealRisk(data.opportunities[1], data.accounts[1])

    assert.equal(riskLabel(score), 'Low')
  })
})

describe('enrichOpportunities', () => {
  it('adds account, weighted amount, risk, and forecast details', () => {
    const opportunities = enrichOpportunities(data)

    assert.equal(opportunities[0].id, 'pred-a')
    assert.equal(opportunities[0].account.name, 'Metro Ultras')
    assert.equal(opportunities[0].weightedAmount, 60000)
    assert.equal(opportunities[0].forecastCategory, 'At Risk')
  })
})

describe('forecastCategory', () => {
  it('classifies strong semi-final predictions as commit', () => {
    assert.equal(forecastCategory(data.opportunities[1], 0), 'Commit')
  })
})

describe('summarizePipeline', () => {
  it('summarizes pipeline and overdue tasks', () => {
    assert.deepEqual(summarizePipeline(data), {
      openPipeline: 200000,
      weightedPipeline: 95000,
      criticalDeals: 1,
      overdueTasks: 1
    })
  })

  it('can summarize one organizer book', () => {
    assert.deepEqual(summarizePipeline(data, 'Jordan Lee'), {
      openPipeline: 50000,
      weightedPipeline: 35000,
      criticalDeals: 0,
      overdueTasks: 0
    })
  })
})

describe('owner and account helpers', () => {
  it('lists organizers alphabetically', () => {
    assert.deepEqual(summarizeOwners(data), ['Jordan Lee', 'Maya Chen'])
  })

  it('filters enriched predictions by organizer', () => {
    const opportunities = enrichOpportunities(data)

    assert.deepEqual(
      filterByOwner(opportunities, 'Maya Chen').map((opportunity) => opportunity.id),
      ['pred-a']
    )
  })

  it('returns fan club context snapshots', () => {
    const snapshot = accountSnapshot(data, 'club-a')

    assert.equal(snapshot.account.name, 'Metro Ultras')
    assert.equal(snapshot.contacts.length, 1)
    assert.equal(snapshot.tasks.length, 1)
    assert.equal(snapshot.activities.length, 1)
  })
})

describe('football seed fixture', () => {
  it('loads tournament-themed demo data', () => {
    assert.ok(seed.accounts.length >= 4)
    assert.ok(seed.opportunities.some((item) => item.name.includes('Final')))
  })
})
