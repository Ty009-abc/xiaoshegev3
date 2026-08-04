/**
 * ci/impact/analyze-impact.js
 *
 * Analyze impact of current changes vs base (HEAD~1 or specified commit).
 * Checks: changed files, affected modules, protected files, change budget.
 * Risk levels: LOW | MEDIUM | HIGH | BLOCKED
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

// Load configurations
const moduleMap = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'module-map.json'), 'utf8'))
const protectedPaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'protected-paths.json'), 'utf8'))
const changeBudget = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'change-budget.json'), 'utf8'))

function analyze(options = {}) {
  const baseCommit = options.baseCommit || 'HEAD~1'
  const currentBranch = options.branch || execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()

  // Get budget
  const budget = changeBudget.overrides[currentBranch] || changeBudget.defaults

  // Get changed files (committed + unstaged)
  let changedFiles = []
  try {
    // Committed changes vs base
    const committed = execSync(`git diff --name-only ${baseCommit}..HEAD`, { encoding: 'utf8' })
      .split('\n').filter(Boolean)
    // Unstaged changes in working tree
    const unstaged = execSync('git diff --name-only', { encoding: 'utf8' })
      .split('\n').filter(Boolean)
    // Untracked files
    const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf8' })
      .split('\n').filter(Boolean)
    changedFiles = [...new Set([...committed, ...unstaged, ...untracked])]
  } catch (e) {
    changedFiles = []
  }

  // Get line count
  let changedLines = 0
  try {
    const diffStat = execSync(`git diff --stat ${baseCommit}..HEAD`, { encoding: 'utf8' })
    const match = diffStat.match(/(\d+) insertions?\(\+\)/)
    const insertions = match ? parseInt(match[1]) : 0
    const dmatch = diffStat.match(/(\d+) deletions?\(-\)/)
    const deletions = dmatch ? parseInt(dmatch[1]) : 0
    changedLines = insertions + deletions
  } catch (e) {
    changedLines = 0
  }

  // Find affected modules
  const affectedModules = new Set()
  for (const file of changedFiles) {
    for (const [modName, modInfo] of Object.entries(moduleMap.modules)) {
      for (const p of modInfo.paths) {
        if (file.startsWith(p)) {
          affectedModules.add(modName)
        }
      }
    }
  }

  // Check protected files
  const touchedProtected = []
  for (const file of changedFiles) {
    for (const pp of protectedPaths.protectedPaths) {
      if (file.startsWith(pp)) {
        touchedProtected.push(file)
      }
    }
    for (const ab of protectedPaths.autoBlock) {
      if (file === ab) {
        touchedProtected.push(`${file} (auto-block)`)
      }
    }
  }

  // Determine risk level
  let riskLevel = 'LOW'
  let blocked = false
  const reasons = []

  if (touchedProtected.length > 0) {
    if (budget.maxProtectedFiles === 0) {
      blocked = true
      riskLevel = 'BLOCKED'
      reasons.push(`Protected files touched: ${touchedProtected.join(', ')}`)
    } else if (touchedProtected.length > budget.maxProtectedFiles) {
      riskLevel = 'HIGH'
      reasons.push(`Protected files exceeded: ${touchedProtected.length} > ${budget.maxProtectedFiles}`)
    }
  }

  if (changedFiles.length > budget.maxBusinessFiles) {
    if (budget.maxBusinessFiles === 0) {
      blocked = true
      riskLevel = 'BLOCKED'
    }
    reasons.push(`Business files: ${changedFiles.length} > ${budget.maxBusinessFiles}`)
  }

  if (changedLines > budget.maxChangedLines) {
    reasons.push(`Changed lines: ${changedLines} > ${budget.maxChangedLines}`)
  }

  if (affectedModules.size > budget.maxModules) {
    reasons.push(`Affected modules: ${affectedModules.size} > ${budget.maxModules}`)
  }

  // Output
  console.log('═══════════════════════════════════════════')
  console.log('  IMPACT ANALYSIS')
  console.log('═══════════════════════════════════════════')
  console.log(`  Branch:           ${currentBranch}`)
  console.log(`  Base:             ${baseCommit}`)
  console.log(`  Changed Files:    ${changedFiles.length}`)
  console.log(`  Changed Lines:    ${changedLines}`)
  console.log(`  Affected Modules: ${[...affectedModules].join(', ') || 'none'}`)
  console.log(`  Protected Touched: ${touchedProtected.length > 0 ? touchedProtected.join(', ') : 'none'}`)
  console.log(`  Risk Level:       ${riskLevel}`)
  if (reasons.length > 0) {
    console.log(`  Reasons:`)
    reasons.forEach(r => console.log(`    - ${r}`))
  }
  console.log('═══════════════════════════════════════════')

  return {
    riskLevel,
    blocked,
    changedFiles,
    changedLines,
    affectedModules: [...affectedModules],
    touchedProtected,
    reasons,
  }
}

// Run if called directly
if (require.main === module) {
  const result = analyze()
  if (result.blocked) {
    process.exit(1)
  }
  process.exit(0)
}

module.exports = { analyze }
