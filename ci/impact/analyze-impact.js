/**
 * ci/impact/analyze-impact.js
 *
 * Analyze impact of current changes vs base (HEAD~1 or specified commit).
 * Checks: changed files, affected modules, protected files, change budget.
 * Risk levels: LOW | MEDIUM | HIGH | BLOCKED
 *
 * Change Budget v2: overrides are scoped per-task with approved flag.
 * Unapproved or expired overrides are ignored.
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

// Load configurations
const moduleMap = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'module-map.json'), 'utf8'))
const protectedPaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'protected-paths.json'), 'utf8'))
const changeBudget = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'change-budget.json'), 'utf8'))

function getBudget(branch) {
  const defaults = changeBudget.defaults || { maxBusinessFiles: 5, maxProtectedFiles: 0, maxChangedLines: 400, maxModules: 2 }
  const overrides = changeBudget.overrides || []

  // Legacy format: object map (pre-v2)
  if (!Array.isArray(overrides) && typeof overrides === 'object') {
    return overrides[branch] || defaults
  }

  // v2 format: array of scoped overrides
  for (const ov of overrides) {
    if (!ov.approved) continue
    const branchMatch = ov.branch === branch || (typeof ov.branch === 'string' && ov.branch.includes('*') && new RegExp('^' + ov.branch.replace('*', '.*') + '$').test(branch))
    if (!branchMatch) continue

    // Check expiry
    if (ov.expiresAtCommit) {
      try {
        const currentHead = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
        const currentShort = currentHead.substring(0, 7)
        if (ov.expiresAtCommit === 'CURRENT_HEAD') continue // Expired: only for specific commit
        if (ov.expiresAtCommit !== currentShort && ov.expiresAtCommit !== currentHead.substring(0, 7)) continue
      } catch (e) {}
    }

    return {
      maxBusinessFiles: ov.maxBusinessFiles ?? defaults.maxBusinessFiles,
      maxProtectedFiles: ov.maxProtectedFiles ?? 0, // never > 0 per policy
      maxChangedLines: ov.maxChangedLines ?? defaults.maxChangedLines,
      maxModules: ov.maxModules ?? defaults.maxModules,
      _override: ov,
    }
  }

  return defaults
}

function analyze(options = {}) {
  const baseCommit = options.baseCommit || 'HEAD~1'
  const currentBranch = options.branch || execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()

  // Get budget
  const budget = getBudget(currentBranch)

  // Get changed files (committed + unstaged)
  let changedFiles = []
  try {
    const committed = execSync(`git diff --name-only ${baseCommit}..HEAD`, { encoding: 'utf8' })
      .split('\n').filter(Boolean)
    const unstaged = execSync('git diff --name-only', { encoding: 'utf8' })
      .split('\n').filter(Boolean)
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
    blocked = true
    riskLevel = 'BLOCKED'
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
  if (budget._override) {
    console.log(`  Override:         ${budget._override.taskId || 'active'}`)
  }
  if (reasons.length > 0) {
    console.log(`  Reasons:`)
    reasons.forEach(r => console.log(`    - ${r}`))
  }
  console.log('═══════════════════════════════════════════')

  return { riskLevel, blocked, changedFiles, changedLines, affectedModules: [...affectedModules], touchedProtected, reasons }
}

if (require.main === module) {
  const result = analyze()
  if (result.blocked) process.exit(1)
  process.exit(0)
}

module.exports = { analyze }
