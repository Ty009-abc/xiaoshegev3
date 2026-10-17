'use strict'
/**
 * config/cloudEnv.js — build-time cloud environment resolver (client runtime).
 *
 * RC814 — replaces the hardcoded production envId previously inlined in app.js.
 *
 * Contract:
 *   - The ACTIVE target comes from ./cloudEnv.generated.js, which is produced at
 *     build time by tools/rc814/select-cloud-env.js. Committed default is production.
 *   - Only the allowlisted target names are accepted (production | staging).
 *   - Unknown / missing / malformed target => THROW (fail closed). Callers must
 *     NOT call wx.cloud.init() on failure, so a bad build can never silently
 *     route to some other environment.
 *
 * This module deliberately contains NO environment id literal: for a staging
 * build the production id must be physically absent from the shipped tree.
 *
 * NOTE: WeChat mini programs have no process.env at runtime, so "build-time
 * selection" means regenerating the generated file, not reading an env var.
 */

var ALLOWED_TARGETS = Object.freeze(['production', 'staging'])

/** Env ids must look like a real CloudBase env id (never a placeholder). */
var ENV_ID_RE = /^[a-z0-9][a-z0-9-]{5,60}$/

function _fail (msg) {
  var err = new Error('[cloudEnv] ' + msg)
  err.code = 'CLOUD_ENV_UNRESOLVED'
  return err
}

/**
 * @returns {{target: string, envId: string}}
 * @throws  {Error} code=CLOUD_ENV_UNRESOLVED when anything is off
 */
function resolveCloudEnv () {
  var gen
  try {
    gen = require('./cloudEnv.generated.js')
  } catch (e) {
    throw _fail('构建目标文件缺失或不可读，拒绝启动')
  }

  if (!gen || typeof gen !== 'object') throw _fail('构建目标文件格式非法')

  var target = gen.buildTarget
  var envId = gen.envId

  if (typeof target !== 'string' || ALLOWED_TARGETS.indexOf(target) === -1) {
    throw _fail('未知构建目标 ' + String(target) + '，仅允许 ' + ALLOWED_TARGETS.join('/'))
  }
  if (typeof envId !== 'string' || !ENV_ID_RE.test(envId)) {
    throw _fail('构建目标 ' + target + ' 的 envId 非法或缺失')
  }
  if (gen.buildTargetSealed !== true) {
    throw _fail('构建目标未封存（buildTargetSealed!=true），拒绝启动')
  }

  return { target: target, envId: envId }
}

/**
 * Non-throwing probe for diagnostics / startup UI.
 * @returns {{ok: boolean, target: (string|null), envId: (string|null), reason: (string|null)}}
 */
function inspectCloudEnv () {
  try {
    var r = resolveCloudEnv()
    return { ok: true, target: r.target, envId: r.envId, reason: null }
  } catch (e) {
    return { ok: false, target: null, envId: null, reason: (e && e.message) || 'UNKNOWN' }
  }
}

module.exports = {
  ALLOWED_TARGETS: ALLOWED_TARGETS,
  resolveCloudEnv: resolveCloudEnv,
  inspectCloudEnv: inspectCloudEnv,
}
