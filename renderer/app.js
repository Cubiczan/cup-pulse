import {
  enrichOpportunities,
  filterByOwner,
  summarizeOwners,
  summarizePipeline
} from '../shared/cup.mjs'

const bridge = window.bridge
const decoder = new TextDecoder('utf-8')
const WORKER = '/workers/main.js'

const state = {
  crm: null,
  owner: 'all',
  peers: 0
}

const elements = {
  ownerFilter: document.querySelector('#owner-filter'),
  opportunityList: document.querySelector('#opportunity-list'),
  resultCount: document.querySelector('#result-count'),
  accountList: document.querySelector('#account-list'),
  metricOpen: document.querySelector('#metric-open'),
  metricWeighted: document.querySelector('#metric-weighted'),
  metricCritical: document.querySelector('#metric-critical'),
  metricOverdue: document.querySelector('#metric-overdue'),
  peerCount: document.querySelector('#peer-count'),
  syncStatus: document.querySelector('#sync-status'),
  addPrediction: document.querySelector('#add-prediction')
}

function send(message) {
  bridge.writeWorkerIPC(WORKER, JSON.stringify(message))
}

function formatCompact(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}

function cssToken(value) {
  return value.replace(/\s+/g, '-')
}

function render() {
  if (!state.crm) return

  const opportunities = filterByOwner(enrichOpportunities(state.crm), state.owner)
  const metrics = summarizePipeline(state.crm, state.owner)

  elements.metricOpen.textContent = `$${formatCompact(metrics.openPipeline)}`
  elements.metricWeighted.textContent = `$${formatCompact(metrics.weightedPipeline)}`
  elements.metricCritical.textContent = metrics.criticalDeals
  elements.metricOverdue.textContent = metrics.overdueTasks
  elements.resultCount.textContent = `${opportunities.length} prediction${opportunities.length === 1 ? '' : 's'}`
  elements.peerCount.textContent = `${state.peers} peer${state.peers === 1 ? '' : 's'}`

  renderAccounts(state.crm.accounts, state.owner)
  renderOpportunities(opportunities)
}

function renderAccounts(accounts, owner) {
  const visible = owner === 'all' ? accounts : accounts.filter((account) => account.owner === owner)

  elements.accountList.replaceChildren(
    ...visible.map((account) => {
      const row = document.createElement('article')
      row.className = 'account-row'
      row.innerHTML = `
        <div>
          <strong>${account.name}</strong>
          <span>${account.owner} · ${account.segment}</span>
        </div>
        <p class="health health-${cssToken(account.health)}">${account.health}</p>
      `
      return row
    })
  )
}

function renderOpportunities(opportunities) {
  elements.opportunityList.replaceChildren(
    ...opportunities.map((opportunity) => {
      const card = document.createElement('article')
      card.className = 'card'
      card.innerHTML = `
        <header>
          <div>
            <h3>${opportunity.name}</h3>
            <p>${opportunity.account.name} · ${opportunity.stage}</p>
          </div>
          <strong>$${formatCompact(opportunity.amount)}</strong>
        </header>
        <div class="pill-row">
          <span class="pill">${opportunity.probability}% confidence</span>
          <span class="pill">Weighted $${formatCompact(opportunity.weightedAmount)}</span>
          <span class="pill risk-${opportunity.riskLabel}">${opportunity.riskLabel} risk (${opportunity.riskScore})</span>
          <span class="pill">${opportunity.forecastCategory}</span>
        </div>
      `
      return card
    })
  )
}

function populateOwnerFilter(data) {
  const owners = summarizeOwners(data)
  for (const owner of owners) {
    const option = document.createElement('option')
    option.value = owner
    option.textContent = owner
    elements.ownerFilter.append(option)
  }
}

function setCrm(data) {
  state.crm = data
  if (elements.ownerFilter.options.length === 1) populateOwnerFilter(data)
  elements.syncStatus.textContent = 'synced'
  render()
}

function onWorkerMessage(message) {
  if (message.type === 'state') {
    setCrm(message.data)
    return
  }

  if (message.type === 'peers') {
    state.peers = message.count
    elements.peerCount.textContent = `${state.peers} peer${state.peers === 1 ? '' : 's'}`
    return
  }

  if (message.type === 'ready') {
    send({ type: 'getState' })
    return
  }

  if (message.type === 'error') {
    elements.syncStatus.textContent = `error: ${message.message}`
  }
}

elements.ownerFilter.addEventListener('change', (event) => {
  state.owner = event.target.value
  render()
})

elements.addPrediction.addEventListener('click', () => {
  if (!state.crm) return

  const id = `pred-${Date.now()}`
  const prediction = {
    id,
    accountId: state.crm.accounts[0].id,
    name: 'New group-stage prediction',
    stage: 'Group',
    amount: 250,
    probability: 50,
    closeDate: '2026-07-12',
    nextStep: 'Share with watch-party group',
    lastActivityDays: 0,
    contactCoverage: 2
  }

  send({ type: 'addPrediction', prediction })
})

bridge.startWorker(WORKER)

bridge.onWorkerIPC(WORKER, (data) => {
  const message = decoder.decode(data)

  if (message === 'updating') {
    elements.syncStatus.textContent = 'updating…'
    return
  }

  if (message === 'updated') {
    elements.syncStatus.textContent = 'update ready'
    return
  }

  try {
    onWorkerMessage(JSON.parse(message))
  } catch {
    console.log('worker ipc:', message)
  }
})

bridge.onWorkerStdout(WORKER, (data) => {
  console.log('worker:', decoder.decode(data))
})

bridge.onWorkerStderr(WORKER, (data) => {
  console.error('worker:', decoder.decode(data))
})
