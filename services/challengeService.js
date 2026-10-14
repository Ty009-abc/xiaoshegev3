/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * services/challengeService.js
 */

function call(name, data) {
  return wx.cloud.callFunction({ name, data }).then(r => r.result)
}

function startChallenge(data) {
  return call('startChallenge', data || {})
}

function getChallengeEvent(recordId) {
  return call('getChallengeEvent', { recordId })
}

function submitChallengeChoice(recordId, eventId, choiceKey) {
  return call('submitChallengeChoice', { recordId, eventId, choiceKey })
}

function getChallengeRecord(recordId) {
  return call('getChallengeRecord', { recordId })
}

/**
 * RC8_13_P0_HISTORY_LIST_SERVER_AUTHORITY_FIX — 服务端权威挑战记录列表。
 * 身份由 getWXContext().OPENID 解析；total ≡ profile.challengeCount。
 * @param {{pageToken?:string,pageSize?:number}} data
 */
function getChallengeRecords(data) {
  return call('getChallengeRecords', data || {})
}

module.exports = {
  startChallenge,
  getChallengeEvent,
  submitChallengeChoice,
  getChallengeRecord,
  getChallengeRecords,
}
