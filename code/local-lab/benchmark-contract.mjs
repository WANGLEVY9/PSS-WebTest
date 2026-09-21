// Public response contract; deliberately independent of all task gold values.
export function retrievalResponse(answer, completed, error = null) {
  if (!completed)
    return {
      task_type: "RETRIEVE",
      status: "UNKNOWN_ERROR",
      retrieved_data: null,
      error_details: error || "No completed response",
    };
  if (!Array.isArray(answer) || answer.some((x) => typeof x !== "string"))
    throw new Error("Malformed benchmark answer");
  return answer.length
    ? {
        task_type: "RETRIEVE",
        status: "SUCCESS",
        retrieved_data: answer,
        error_details: null,
      }
    : {
        task_type: "RETRIEVE",
        status: "NOT_FOUND_ERROR",
        retrieved_data: [],
        error_details:
          "No matching reviewers found after examining the available reviews.",
      };
}

export function evaluatorSummary(result) {
  const errors = [];
  function visit(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "error_msg" && typeof child === "string")
        errors.push(child.slice(0, 600));
      else if (
        !/expected|actual|reference|response/i.test(key) &&
        typeof child === "object"
      )
        visit(child);
    }
  }
  visit(result.evaluators_results);
  return {
    authority: "WebArena-Verified official evaluator",
    score: result.score,
    status: result.status,
    passed:
      result.status === "error"
        ? null
        : result.score === 1 && result.status === "success",
    version: result.webarena_verified_version,
    evaluator_checksum: result.webarena_verified_evaluator_checksum,
    data_checksum: result.webarena_verified_data_checksum,
    task_revision: result.task_revision,
    errors,
  };
}
