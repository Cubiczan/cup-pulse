function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = String(text)
  return node
}

export function cssToken(value) {
  return String(value).replace(/\s+/g, '-')
}

export function renderAccountRow(account) {
  const row = el('article', 'account-row')
  const copy = el('div')
  copy.append(
    el('strong', null, account.name),
    el('span', null, `${account.owner} · ${account.segment}`)
  )
  row.append(copy, el('p', `health health-${cssToken(account.health)}`, account.health))
  return row
}

export function renderOpportunityCard(opportunity, formatCompact) {
  const card = el('article', 'card')
  const header = el('header')
  const titles = el('div')
  titles.append(
    el('h3', null, opportunity.name),
    el('p', null, `${opportunity.account.name} · ${opportunity.stage}`)
  )
  header.append(titles, el('strong', null, `$${formatCompact(opportunity.amount)}`))

  const pills = el('div', 'pill-row')
  pills.append(
    el('span', 'pill', `${opportunity.probability}% confidence`),
    el('span', 'pill', `Weighted $${formatCompact(opportunity.weightedAmount)}`),
    el(
      'span',
      `pill risk-${opportunity.riskLabel}`,
      `${opportunity.riskLabel} risk (${opportunity.riskScore})`
    ),
    el('span', 'pill', opportunity.forecastCategory)
  )

  card.append(header, pills)
  return card
}
