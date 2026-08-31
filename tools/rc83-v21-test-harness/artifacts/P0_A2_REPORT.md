## P0_A2_REPORT

BRANCH = feat/rc8.3-stage20-v21-test-harness
BASE_SHA = 82f27a0cb324aadb7fd6021e4db97ca932d4994a
CANDIDATE_SHA = c582eaa4b8c7877ffc7c52cc587f0def8b8ec204

GENERATOR_VERSION = P0-A2.1
RUN_SEED_EXAMPLE = F01:V00 → hashSeed "F01:00" = 1196023093 (mulberry32 seed)

QUESTION_SOURCE_REUSED = YES (questionnaireV21.js, zero schema copy)
QUESTION_COUNT = 18

SCENARIO_FAMILY_COUNT = 10
BASE_CASE_COUNT = 100
NEGATIVE_CASE_COUNT = 10

DETERMINISTIC_GENERATOR = YES (FNV-1a hashSeed + mulberry32; no Math.random / Date.now / env entropy)
DETERMINISM_GENERATION_CHECKS = 10/10 PASS
DETERMINISM_GENERATION_MISMATCH = 0

DISPLAY_POSITION_GENERATOR = YES (seeded varied / constant / alternating / sequential / boundary 0-3)
EXACT_18Q_CONTRACT = YES (all 100 base cases = 18 tuples {questionId, optionId, displayPosition}; qid from canonical; optionId legal; position int 0-3)

NEGATIVE_GENERATOR = YES (N01 missing_answer, N02 duplicate_questionId, N03 unknown_questionId, N04 unknown_optionId, N05 missing_displayPosition, N06 invalid_displayPosition, N07 malformed_entry, N08 empty_answers, N09 extra_answer, N10 non_array_payload; excluded from 100 denominator)

PRODUCTION_TRAFFIC_USED = false
PRODUCTION_DB_WRITES = 0
PRODUCTION_FILES_CHANGED = 0
INFERENCE_FILES_CHANGED = 0

GATE_B_PROTOCOL_CHANGED = NO
PRIMARY_MODE_CHANGED = NO

READY_FOR_A3 = YES
RESULT = PASS

STOP.
