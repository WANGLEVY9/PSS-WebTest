const TOP_LEVEL_FIELDS = new Set(['controls']);
const CONTROL_FIELDS = new Set([
  'target_id', 'role', 'name', 'interaction', 'value', 'placeholder',
  'state', 'bounding_box', 'center_normalized_1000'
]);
const STATE_FIELDS = new Set(['disabled', 'checked', 'selected', 'expanded']);
const INTERACTIONS = new Set(['click', 'type', 'observe']);
const TARGET_ID = /^c(?:[0-9]{1,3})$/;
const TEXT_LIMIT = 300;

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
}

function assertExactKeys(value, allowed, label) {
  assertObject(value, label);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length) throw new Error(`${label} contains forbidden fields: ${unexpected.sort().join(', ')}`);
}

function safeText(value, label, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new TypeError(`${label} is required`);
    return undefined;
  }
  if (typeof value !== 'string' || value.length > TEXT_LIMIT) throw new TypeError(`${label} must be a string of at most ${TEXT_LIMIT} characters`);
  return value;
}

function normalizeState(state) {
  if (state === undefined) return undefined;
  assertExactKeys(state, STATE_FIELDS, 'control.state');
  const normalized = {};
  for (const key of STATE_FIELDS) {
    if (state[key] !== undefined) {
      if (typeof state[key] !== 'boolean') throw new TypeError(`control.state.${key} must be boolean`);
      normalized[key] = state[key];
    }
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

function normalizePoint(point) {
  if (point === undefined) return undefined;
  assertExactKeys(point, new Set(['x', 'y']), 'control.center_normalized_1000');
  if (!Number.isInteger(point.x) || !Number.isInteger(point.y) || point.x < 0 || point.x > 1000 || point.y < 0 || point.y > 1000) {
    throw new TypeError('control.center_normalized_1000 must contain integer x/y in [0, 1000]');
  }
  return { x: point.x, y: point.y };
}

function normalizeBoundingBox(box) {
  if (box === undefined) return undefined;
  assertExactKeys(box, new Set(['x', 'y', 'width', 'height']), 'control.bounding_box');
  for (const key of ['x', 'y', 'width', 'height']) {
    if (!Number.isFinite(box[key])) throw new TypeError(`control.bounding_box.${key} must be finite`);
  }
  if (box.width < 0 || box.height < 0) throw new TypeError('control.bounding_box width/height must be non-negative');
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

/**
 * Canonicalize the only structure Hybrid agents may receive. The producer must
 * already filter to visible and interactable controls; this boundary rejects
 * raw trees, selectors, stable IDs, URLs, milestones, and arbitrary fields.
 */
export function canonicalizeHybridProjection(projection) {
  assertExactKeys(projection, TOP_LEVEL_FIELDS, 'pageStructure');
  if (!Array.isArray(projection.controls) || projection.controls.length > 160) {
    throw new TypeError('pageStructure.controls must contain at most 160 controls');
  }
  const seenIds = new Set();
  const controls = projection.controls.map((control, index) => {
    assertExactKeys(control, CONTROL_FIELDS, `pageStructure.controls[${index}]`);
    if (typeof control.target_id !== 'string' || !TARGET_ID.test(control.target_id)) throw new TypeError(`pageStructure.controls[${index}].target_id must match c0..c999`);
    if (seenIds.has(control.target_id)) throw new Error(`pageStructure controls must use unique target_id values: ${control.target_id}`);
    seenIds.add(control.target_id);
    const role = safeText(control.role, `pageStructure.controls[${index}].role`, { required: true });
    const name = safeText(control.name, `pageStructure.controls[${index}].name`, { required: true });
    if (!role.trim()) throw new TypeError(`pageStructure.controls[${index}].role must not be empty`);
    const interaction = control.interaction ?? (role === 'textbox' ? 'type' : 'click');
    if (!INTERACTIONS.has(interaction)) throw new TypeError(`pageStructure.controls[${index}].interaction is invalid`);
    const normalized = {
      target_id: control.target_id,
      role,
      name,
      interaction
    };
    const value = safeText(control.value, `pageStructure.controls[${index}].value`);
    const placeholder = safeText(control.placeholder, `pageStructure.controls[${index}].placeholder`);
    const state = normalizeState(control.state);
    const boundingBox = normalizeBoundingBox(control.bounding_box);
    const center = normalizePoint(control.center_normalized_1000);
    if (value !== undefined) normalized.value = value;
    if (placeholder !== undefined) normalized.placeholder = placeholder;
    if (state !== undefined) normalized.state = state;
    if (boundingBox !== undefined) normalized.bounding_box = boundingBox;
    if (center !== undefined) normalized.center_normalized_1000 = center;
    return normalized;
  });
  return { controls };
}
