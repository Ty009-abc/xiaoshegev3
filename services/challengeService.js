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

module.exports = {
  startChallenge,
  getChallengeEvent,
  submitChallengeChoice,
  getChallengeRecord,
}
